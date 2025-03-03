/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { expect } from "chai"
import stripAnsi from "strip-ansi"
import { join } from "path"

import { gardenPlugin } from "../src"
import { gardenPlugin as conftestPlugin } from "@garden-io/garden-conftest/build/src"
import { dedent } from "@garden-io/sdk/build/src/util/string"
import { makeTestGarden } from "@garden-io/sdk/build/src/testing"

import { TestTask } from "@garden-io/core/build/src/tasks/test"

describe.skip("conftest-kubernetes provider", () => {
  const projectRoot = join(__dirname, "test-project")

  it("should add a conftest module for each helm module, and add runtime dependencies as necessary", async () => {
    const garden = await makeTestGarden(projectRoot, {
      plugins: [gardenPlugin(), conftestPlugin()],
    })

    const graph = await garden.getConfigGraph({ log: garden.log, emit: false })
    const helmModule = graph.getModule("helm")
    const module = graph.getModule("conftest-helm")

    expect(module.type).to.equal("conftest-helm")
    expect(module.path).to.equal(helmModule.path)
    expect(module.spec).to.eql({
      build: { dependencies: [], timeout: 1200 },
      namespace: "main",
      policyPath: "../custom-policy",
      sourceModule: "helm",
      combine: false,
      runtimeDependencies: ["kubernetes"],
    })
  })

  it("should add a conftest module for each kubernetes module", async () => {
    const garden = await makeTestGarden(projectRoot, {
      plugins: [gardenPlugin(), conftestPlugin()],
    })

    const graph = await garden.getConfigGraph({ log: garden.log, emit: false })
    const kubernetesModule = graph.getModule("kubernetes")
    const module = graph.getModule("conftest-kubernetes")

    expect(module.path).to.equal(kubernetesModule.path)
    expect(module.spec).to.eql({
      build: { dependencies: [], timeout: 1200 },
      files: kubernetesModule.spec.files,
      namespace: "main",
      policyPath: "../custom-policy",
      combine: false,
      sourceModule: "kubernetes",
    })
  })

  describe("conftest-helm module", () => {
    it("should be able to test files in a remote Helm chart", async () => {
      const garden = await makeTestGarden(projectRoot, {
        plugins: [gardenPlugin(), conftestPlugin()],
      })

      const graph = await garden.getConfigGraph({ log: garden.log, emit: false })
      const action = graph.getTest("conftest-helm")

      const testTask = new TestTask({
        garden,
        log: garden.log,
        graph,
        action,
        force: true,
        forceBuild: true,
      })

      const key = testTask.getKey()
      const res = await garden.processTasks({ log: garden.log, tasks: [testTask], throwOnError: true })
      const result = res.results[key]

      expect(result).to.exist
      expect(result!.error).to.exist
      expect(stripAnsi(result!.error!.message)).to.equal(dedent`
      conftest reported 1 failure(s):

      FAIL -  - StatefulSet replicas should not be 1
      `)
    })
  })
})
