/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import AsyncLock from "async-lock"
import chalk from "chalk"
import { Autocompleter, AutocompleteSuggestion } from "../cli/autocomplete"
import { parseCliVarFlags } from "../cli/helpers"
import { ParameterObject, ParameterValues } from "../cli/params"
import { CloudApi, CloudApiFactory, CloudApiFactoryParams, getGardenCloudDomain } from "../cloud/api"
import type { Command } from "../commands/base"
import { getBuiltinCommands, flattenCommands } from "../commands/commands"
import { getCustomCommands } from "../commands/custom"
import type { ServeCommand } from "../commands/serve"
import { GlobalConfigStore } from "../config-store/global"
import { ProjectConfig } from "../config/project"
import { EventBus, GardenEventAnyListener } from "../events/events"
import { ConfigDump, Garden, GardenOpts, makeDummyGarden, resolveGardenParamsPartial } from "../garden"
import type { Log } from "../logger/log-entry"
import { MonitorManager } from "../monitors/manager"
import type { GardenPluginReference } from "../plugin/plugin"
import { environmentToString } from "../types/namespace"
import { omitUndefined } from "../util/objects"
import {
  AutocompleteCommand,
  ReloadCommand,
  LogLevelCommand,
  HideCommand,
  _GetDeployStatusCommand,
  _GetActionStatusesCommand,
  _ShellCommand,
} from "./commands"
import { getGardenInstanceKey, GardenInstanceKeyParams } from "./helpers"

interface InstanceContext {
  garden: Garden
  listener: GardenEventAnyListener
}

interface ProjectRootContext {
  commands: Command[]
  autocompleter: Autocompleter
  configDump?: ConfigDump
}

interface GardenInstanceManagerParams {
  log: Log
  sessionId: string
  plugins: GardenPluginReference[]
  serveCommand?: ServeCommand
  extraCommands?: Command[]
  defaultOpts?: Partial<GardenOpts>
  cloudApiFactory?: CloudApiFactory
}

// TODO: clean up unused instances after some timeout since last request and when no monitors are active

let _manager: GardenInstanceManager | undefined

export class GardenInstanceManager {
  public readonly sessionId: string

  private plugins: GardenPluginReference[]
  private instances: Map<string, InstanceContext>
  private projectRoots: Map<string, ProjectRootContext>
  private cloudApiFactory: CloudApiFactory
  private cloudApis: Map<string, CloudApi>
  private lastRequested: Map<string, Date>
  private lock: AsyncLock
  private builtinCommands: Command[]
  private defaultProjectRootContext: ProjectRootContext
  public readonly monitors: MonitorManager
  private defaultOpts: Partial<GardenOpts> // Used for testing
  public readonly serveCommand?: ServeCommand

  /**
   * Events from every managed Garden instance are piped to this EventBus. Each event emitted implicitly includes
   * a `gardenKey` property with the instance key and a `sessionId`.
   */
  public events: EventBus

  public defaultProjectRoot?: string
  public defaultEnv?: string

  private constructor({
    log,
    sessionId,
    serveCommand,
    extraCommands,
    defaultOpts,
    plugins,
    cloudApiFactory,
  }: GardenInstanceManagerParams) {
    this.serveCommand = serveCommand
    this.sessionId = sessionId
    this.instances = new Map()
    this.projectRoots = new Map()
    this.cloudApis = new Map()
    this.lastRequested = new Map()
    this.defaultOpts = defaultOpts || {}
    this.plugins = plugins
    this.cloudApiFactory = cloudApiFactory || CloudApi.factory

    this.events = new EventBus()
    this.monitors = new MonitorManager(log, this.events)
    this.lock = new AsyncLock()

    this.builtinCommands = [
      ...getBuiltinCommands(),
      ...flattenCommands([
        new AutocompleteCommand(this),
        new ReloadCommand(serveCommand),
        new LogLevelCommand(),
        new HideCommand(),
        new _GetDeployStatusCommand(),
        new _GetActionStatusesCommand(),
        new _ShellCommand(),
      ]),
      ...(extraCommands || []),
    ]

    this.defaultProjectRootContext = {
      commands: this.builtinCommands,
      autocompleter: new Autocompleter({ log, commands: this.builtinCommands, configDump: undefined }),
    }
  }

  static getInstance(params: GardenInstanceManagerParams & { force?: boolean }) {
    if (!_manager || params.force) {
      _manager = new GardenInstanceManager(params)
    }
    return _manager
  }

  getKey(params: GardenInstanceKeyParams): string {
    return getGardenInstanceKey(params)
  }

  async ensureInstance(log: Log, params: GardenInstanceKeyParams, opts: GardenOpts) {
    const key = this.getKey(params)
    this.lastRequested.set(key, new Date())

    return this.lock.acquire(key, async () => {
      const instance = this.instances.get(key)
      let garden = instance?.garden

      if (!garden || garden.needsReload() || opts.forceRefresh) {
        const envStr = environmentToString(params)

        const reason = !garden
          ? "none found for key"
          : garden.needsReload()
          ? "flagged for reload"
          : "forceRefresh=true"

        log.verbose(`Initializing Garden context for ${envStr} (${reason})`)
        log.debug(`Instance key: ${key}`)

        garden = await Garden.factory(params.projectRoot, {
          // The sessionId should be the same as the surrounding process.
          // For each command run, this will be set as the parentSessionId,
          // and the command-specific Garden (cloned in `Command.run()`) gets its own sessionId.
          sessionId: this.sessionId,
          monitors: this.monitors,
          plugins: this.plugins,
          ...this.defaultOpts,
          ...garden?.opts,
          ...opts,
          ...params,
        })
        this.set(log, garden)

        const rootContext = this.projectRoots.get(params.projectRoot)

        if (opts.forceRefresh || !rootContext || !rootContext.configDump) {
          const configDump = await garden.dumpConfig({
            log,
            resolveGraph: false,
            resolveProviders: false,
            resolveWorkflows: false,
          })
          await this.updateProjectRootContext(log, params.projectRoot, configDump)
        }
      }

      return garden
    })
  }

  async getCloudApi(params: CloudApiFactoryParams) {
    const { cloudDomain } = params
    let api = this.cloudApis.get(cloudDomain)

    if (!api) {
      api = await this.cloudApiFactory(params)
      api && this.cloudApis.set(cloudDomain, api)
    }

    return api
  }

  // TODO: allow clearing a specific context
  async clear() {
    const instances = this.instances.values()

    for (const { garden } of instances) {
      garden.close()
    }

    this.instances.clear()
    this.projectRoots.clear()
  }

  async reload(log: Log) {
    const projectRoots = [...this.projectRoots.keys()]

    // Clear existing instances that have no monitors running
    await this.clear()

    // Reload context for each project root
    await Promise.all(
      projectRoots.map(async (projectRoot) => {
        await this.updateProjectRootContext(log, projectRoot)
      })
    )
  }

  set(log: Log, garden: Garden) {
    const key = garden.getInstanceKey()
    const existing = this.instances.get(key)

    // Flag the instance for reloading when configs change
    garden.events.once("configChanged", (_payload) => {
      if (!garden.needsReload) {
        garden.needsReload(true)
        garden.log.info(
          chalk.magenta.bold(
            `${chalk.white("→")} Config change detected. Project will be reloaded when the next command is run.`
          )
        )
      }
    })

    // Make sure file watching is started and updated after config file scans
    garden.events.once("configsScanned", (_) => {
      garden.watchPaths()
    })

    // Update autocompleter when config is resolved
    garden.events.on("configGraph", ({ graph }) => {
      garden
        .dumpConfig({
          log: garden.log,
          graph,
          resolveGraph: false,
          resolveProviders: false,
          resolveWorkflows: false,
        })
        .then((configDump) => {
          return this.updateProjectRootContext(garden.log, garden.projectRoot, configDump)
        })
        .catch((error) => {
          garden.log.debug(`Error when updating config for autocompleter: ${error}`)
        })
    })

    const listener =
      existing?.listener ||
      ((name, payload) => {
        this.events.emit(name, payload)
      })
    if (existing?.garden) {
      existing.garden.events.offAny(listener)
    }
    garden.events.ensureAny(listener)

    this.instances.set(key, { garden, listener })
    log.debug(`Garden context updated for key ${key}`)
  }

  getAll(): Garden[] {
    return Array.from(this.instances.values()).map(({ garden }) => garden)
  }

  getCommands(log: Log, projectRoot?: string) {
    const { commands } = this.getProjectRootContext(log, projectRoot)
    return commands
  }

  getAutocompleteSuggestions({
    log,
    projectRoot,
    input,
    ignoreGlobalFlags = true,
  }: {
    log: Log
    projectRoot?: string
    input: string
    ignoreGlobalFlags?: boolean
  }): AutocompleteSuggestion[] {
    const { autocompleter } = this.getProjectRootContext(log, projectRoot)
    // TODO: make the opts configurable
    return autocompleter.getSuggestions(input, { limit: 100, ignoreGlobalFlags })
  }

  async ensureProjectRootContext(log: Log, projectRoot: string) {
    return this.projectRoots.get(projectRoot) || this.updateProjectRootContext(log, projectRoot)
  }

  private getProjectRootContext(_log: Log, projectRoot?: string) {
    if (!projectRoot || !this.projectRoots.get(projectRoot)) {
      return this.defaultProjectRootContext
    }

    return this.projectRoots.get(projectRoot)!
  }

  async updateProjectRootContext(log: Log, projectRoot: string, configDump?: ConfigDump) {
    const customCommands = await getCustomCommands(log, projectRoot)
    const commands = [...this.builtinCommands, ...customCommands]
    const context: ProjectRootContext = {
      commands,
      autocompleter: new Autocompleter({ log, commands, configDump }),
      configDump,
    }
    this.projectRoots.set(projectRoot, context)
    this.events.emit("autocompleterUpdated", { projectRoot })
    return context
  }

  async getGardenForRequest({
    command,
    projectConfig,
    globalConfigStore,
    log,
    args,
    opts,
    environmentString,
    sessionId,
  }: {
    command?: Command
    projectConfig: ProjectConfig
    globalConfigStore: GlobalConfigStore
    log: Log
    args: ParameterValues<ParameterObject>
    opts: ParameterValues<ParameterObject>
    environmentString?: string
    sessionId: string
  }) {
    let cloudApi: CloudApi | undefined

    if (!command?.noProject) {
      cloudApi = await this.getCloudApi({
        log,
        cloudDomain: getGardenCloudDomain(projectConfig.domain),
        globalConfigStore,
      })
    }

    const gardenOpts: GardenOpts = {
      cloudApi,
      commandInfo: { name: command ? command.getFullName() : "serve", args, opts: omitUndefined(opts) },
      config: projectConfig,
      environmentString: opts.env || environmentString || this.defaultEnv,
      globalConfigStore,
      log,
      plugins: this.plugins,
      variableOverrides: parseCliVarFlags(opts.var),
      sessionId,
    }

    const projectRoot = projectConfig.path

    if (command && command.noProject) {
      return makeDummyGarden(projectRoot, gardenOpts)
    }

    const gardenParams = await resolveGardenParamsPartial(projectRoot, gardenOpts)

    return this.ensureInstance(
      log,
      {
        projectRoot,
        environmentName: gardenParams.environmentName,
        namespace: gardenParams.namespace,
        variableOverrides: gardenOpts.variableOverrides || {},
      },
      gardenOpts
    )
  }
}
