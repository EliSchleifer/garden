/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { Command, CommandParams, CommandResult } from "./base"
import { printHeader } from "../logger/util"
import { CloudApi, getGardenCloudDomain } from "../cloud/api"
import { dedent, deline } from "../util/string"
import { getCloudDistributionName } from "../util/util"
import { ConfigurationError } from "../exceptions"
import { ProjectConfig } from "../config/project"
import { findProjectConfig } from "../config/base"
import { BooleanParameter } from "../cli/params"

export const logoutOpts = {
  "disable-project-check": new BooleanParameter({
    help: deline`Disables the check that this is run from within a Garden Project. Logs you out from the default Garden Cloud domain`,
    defaultValue: false,
  }),
}

type Opts = typeof logoutOpts

export class LogOutCommand extends Command<{}, Opts> {
  name = "logout"
  help = "Log out of Garden Cloud."
  override noProject = true

  override description = dedent`
    Logs you out of Garden Cloud.
  `
  override options = logoutOpts

  override printHeader({ log }) {
    printHeader(log, "Log out", "☁️")
  }

  async action({ garden, log, opts }: CommandParams): Promise<CommandResult> {
    // The Cloud API is missing from the Garden class for commands with noProject
    // so we initialize it with a cloud domain derived from `getGardenCloudDomain`.

    let projectConfig: ProjectConfig | undefined = undefined
    const forceProjectCheck = !opts["disable-project-check"]

    if (forceProjectCheck) {
      projectConfig = await findProjectConfig({ log, path: garden.projectRoot })

      // Fail if this is not run within a garden project
      if (!projectConfig) {
        throw new ConfigurationError({
          message: `Not a project directory (or any of the parent directories): ${garden.projectRoot}`,
        })
      }
    }

    const cloudDomain: string | undefined = getGardenCloudDomain(projectConfig?.domain)

    const distroName = getCloudDistributionName(cloudDomain)

    try {
      // The Enterprise API is missing from the Garden class for commands with noProject
      // so we initialize it here.

      const token = await garden.globalConfigStore.get("clientAuthTokens", cloudDomain)

      if (!token) {
        log.info({ msg: `You're already logged out from ${cloudDomain}.` })
        return {}
      }

      const cloudApi = await CloudApi.factory({
        log,
        cloudDomain,
        skipLogging: true,
        globalConfigStore: garden.globalConfigStore,
      })

      if (!cloudApi) {
        return {}
      }

      await cloudApi.post("token/logout", { headers: { Cookie: `rt=${token?.refreshToken}` } })
      cloudApi.close()
    } catch (err) {
      const msg = dedent`
      The following issue occurred while logging out from ${distroName} (your session will be cleared regardless): ${err}\n
      `
      log.warn(msg)
    } finally {
      await CloudApi.clearAuthToken(log, garden.globalConfigStore, cloudDomain)
      log.info({ msg: `Successfully logged out from ${cloudDomain}.` })
    }
    return {}
  }
}
