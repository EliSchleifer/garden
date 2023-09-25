/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { makeTestGarden } from "@garden-io/sdk/build/src/testing"
import { resolve } from "path"
import { gardenPlugin } from "../src/index"
import { defaultTerraformVersion } from "../src/cli"
import { ValidateCommand } from "@garden-io/core/build/src/commands/validate"
import { withDefaultGlobalOpts } from "@garden-io/core/build/test/helpers"

describe("terraform validation", () => {
  for (const project of ["test-project", "test-project-action", "test-project-module"]) {
    it(`should pass validation for ${project}`, async () => {
      const testRoot = resolve(__dirname, "../../test/", project)
      const garden = await makeTestGarden(testRoot, {
        plugins: [gardenPlugin()],
        variableOverrides: { "tf-version": defaultTerraformVersion },
      })

      const command = new ValidateCommand()
      await command.action({
        garden,
        log: garden.log,
        args: {},
        opts: withDefaultGlobalOpts({}),
      })
    })
  }
})
