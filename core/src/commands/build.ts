/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
  Command,
  CommandResult,
  CommandParams,
  handleProcessResults,
  ProcessCommandResult,
  processCommandResultSchema,
} from "./base"
import dedent from "dedent"
import { printHeader } from "../logger/util"
import { flatten } from "lodash"
import { BuildTask } from "../tasks/build"
import { StringsParameter, BooleanParameter } from "../cli/params"
import { uniqByName } from "../util/util"
import { deline } from "../util/string"
import { isBuildAction } from "../actions/build"
import { watchParameter, watchRemovedWarning } from "./helpers"
import { warnOnLinkedActions } from "../actions/helpers"

const buildArgs = {
  names: new StringsParameter({
    help: "Specify Builds to run. You may specify multiple names, separated by spaces.",
    spread: true,
    getSuggestions: ({ configDump }) => {
      return Object.keys(configDump.actionConfigs.Build)
    },
  }),
}

const buildOpts = {
  "force": new BooleanParameter({ help: "Force re-build.", aliases: ["f"] }),
  "watch": watchParameter,
  "with-dependants": new BooleanParameter({
    help: deline`
      Also rebuild any Builds that depend on one of the Builds specified as CLI arguments (recursively).
      Note: This option has no effect unless a list of Build names is specified as CLI arguments (since otherwise, every
      Build in the project will be performed anyway).
  `,
  }),
}

type Args = typeof buildArgs
type Opts = typeof buildOpts

export class BuildCommand extends Command<Args, Opts> {
  name = "build"
  help = "Perform your Builds."

  override protected = true
  override streamEvents = true

  override description = dedent`
    Runs all or specified Builds, taking into account build dependency order.
    Optionally stays running and automatically builds when sources (or dependencies' sources) change.

    Examples:

        garden build                   # build everything in the project
        garden build my-image          # only build my-image
        garden build image-a image-b   # build image-a and image-b
        garden build --force           # force re-builds, even if builds had already been performed at current version
        garden build -l 3              # build with verbose log level to see the live log output
  `

  override arguments = buildArgs
  override options = buildOpts

  override outputsSchema = () => processCommandResultSchema()

  override printHeader({ log }) {
    printHeader(log, "Build", "🔨")
  }

  async action(params: CommandParams<Args, Opts>): Promise<CommandResult<ProcessCommandResult>> {
    const { garden, log, args, opts } = params

    if (opts.watch) {
      await watchRemovedWarning(garden, log)
    }

    await garden.clearBuilds()

    const graph = await garden.getConfigGraph({ log, emit: true })
    let actions = graph.getBuilds({ names: args.names })

    if (opts["with-dependants"]) {
      // Then we include build dependants (recursively) in the list of modules to build.
      actions = uniqByName([
        ...actions,
        ...flatten(
          actions.map((m) =>
            graph.getDependants({ kind: "Build", name: m.name, recursive: true }).filter(isBuildAction)
          )
        ),
      ])
    }

    await warnOnLinkedActions(garden, log, actions)

    const tasks = actions.flatMap(
      (action) =>
        new BuildTask({
          garden,
          graph,
          log,
          action,
          force: opts.force,
          forceActions: [],
        })
    )

    const result = await garden.processTasks({ tasks, log })

    return handleProcessResults(garden, log, "build", result)
  }
}
