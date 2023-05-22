/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { expect } from "chai"
import { makeTestGardenA } from "../../../helpers"
import { TaskConfig } from "../../../../src/config/task"
import { taskFromConfig } from "../../../../src/types/task"
import { DEFAULT_RUN_TIMEOUT_SEC } from "../../../../src/constants"

describe("taskFromConfig", () => {
  it("should propagate the disabled flag from the config", async () => {
    const config: TaskConfig = {
      name: "test",
      cacheResult: true,
      dependencies: [],
      disabled: true,
      spec: {},
      timeout: DEFAULT_RUN_TIMEOUT_SEC,
    }

    const garden = await makeTestGardenA()
    const graph = await garden.getConfigGraph({ log: garden.log, emit: false })
    const module = graph.getModule("module-a")
    const task = taskFromConfig(module, config)

    expect(task.disabled).to.be.true
  })

  it("should set disabled=true if the module is disabled", async () => {
    const config: TaskConfig = {
      name: "test",
      cacheResult: true,
      dependencies: [],
      disabled: false,
      spec: {},
      timeout: DEFAULT_RUN_TIMEOUT_SEC,
    }

    const garden = await makeTestGardenA()
    const graph = await garden.getConfigGraph({ log: garden.log, emit: false })
    const module = graph.getModule("module-a")
    module.disabled = true
    const task = taskFromConfig(module, config)

    expect(task.disabled).to.be.true
  })
})
