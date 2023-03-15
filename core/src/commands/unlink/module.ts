/*
 * Copyright (C) 2018-2022 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import dedent = require("dedent")

import { Command, CommandResult, CommandParams } from "../base"
import { removeLinkedSources } from "../../util/ext-source-util"
import { printHeader } from "../../logger/util"
import { LinkedSource } from "../../config-store/local"
import { StringsParameter, BooleanParameter } from "../../cli/params"

const unlinkModuleArguments = {
  modules: new StringsParameter({
    help: "The name(s) of the module(s) to unlink. You may specify multiple modules, separated by spaces.",
    spread: true,
    getSuggestions: ({ configDump }) => {
      return Object.keys(configDump.moduleConfigs)
    },
  }),
}

const unlinkModuleOptions = {
  all: new BooleanParameter({
    help: "Unlink all modules.",
  }),
}

type Args = typeof unlinkModuleArguments
type Opts = typeof unlinkModuleOptions

export class UnlinkModuleCommand extends Command<Args, Opts> {
  name = "module"
  help = "Unlink a previously linked remote module from its local directory."
  arguments = unlinkModuleArguments
  options = unlinkModuleOptions

  description = dedent`
    After unlinking a remote module, Garden will go back to reading the module's source from
    its remote URL instead of its local directory.

    Examples:

        garden unlink module my-module  # unlinks my-module
        garden unlink module --all      # unlink all modules
  `

  printHeader({ headerLog }) {
    printHeader(headerLog, "Unlink module", "⛓️")
  }

  async action({ garden, log, args, opts }: CommandParams<Args, Opts>): Promise<CommandResult<LinkedSource[]>> {
    const sourceType = "module"

    const { modules = [] } = args

    if (opts.all) {
      await garden.configStore.set("linkedModuleSources", {})
      log.info("Unlinked all modules")
      return { result: [] }
    }

    const linkedModuleSources = await removeLinkedSources({
      garden,
      sourceType,
      names: modules,
    })

    log.info(`Unlinked module(s) ${modules.join(" ")}`)

    return { result: linkedModuleSources }
  }
}
