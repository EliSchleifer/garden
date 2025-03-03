/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { GardenModule } from "./module"
import { TestConfig, testConfigSchema } from "../config/test"
import { getEntityVersion, hashStrings, versionStringPrefix } from "../vcs/vcs"
import { findByName } from "../util/util"
import { NotFoundError } from "../exceptions"
import { createSchema, joi, joiUserIdentifier, versionStringSchema } from "../config/common"
import { sortBy } from "lodash"
import { serializeConfig } from "../config/module"
import { RunResult, runResultSchema } from "../plugin/base"
import { ModuleGraph } from "../graph/modules"

export interface GardenTest<M extends GardenModule = GardenModule> {
  name: string
  module: M
  disabled: boolean
  config: M["testConfigs"][0]
  spec: M["testConfigs"][0]["spec"]
  version: string
}

export const testSchema = createSchema({
  name: "module-test",
  keys: () => ({
    name: joiUserIdentifier().description("The name of the test."),
    module: joi.object().unknown(true), // This causes a stack overflow: joi.lazy(() => moduleSchema()),
    disabled: joi.boolean().default(false).description("Set to true if the test is disabled."),
    config: testConfigSchema(),
    spec: joi.object().description("The raw configuration of the test (specific to each plugin)."),
    version: versionStringSchema().description("The version of the test."),
  }),
  options: { presence: "required" },
})

export function testFromConfig<M extends GardenModule = GardenModule>(
  module: M,
  config: TestConfig,
  graph: ModuleGraph
): GardenTest<M> {
  const deps = graph.getDependencies({
    kind: "test",
    name: module.name + "." + config.name,
    recursive: true,
  })
  // We sort the dependencies by type and name to avoid unnecessary cache invalidation due to possible ordering changes.
  const depHashes = [
    ...sortBy(deps.build, (mod) => mod.name).map((mod) => mod.version),
    ...sortBy(deps.deploy, (s) => s.module.name).map((s) => serializeConfig(s)),
    ...sortBy(deps.run, (t) => t.module.name).map((t) => serializeConfig(t)),
  ]
  const version = `${versionStringPrefix}${hashStrings([getEntityVersion(module, config), ...depHashes])}`
  return {
    name: config.name,
    module,
    disabled: module.disabled || config.disabled,
    config,
    spec: config.spec,
    version,
  }
}

export function testFromModule<M extends GardenModule = GardenModule>(
  module: M,
  name: string,
  graph: ModuleGraph
): GardenTest<M> {
  const config = findByName(module.testConfigs, name)

  if (!config) {
    throw new NotFoundError({
      message: `Could not find test ${name} in module "${module.name}"`,
    })
  }

  return testFromConfig(module, config, graph)
}

export interface TestResult extends RunResult {}

export const testResultSchema = createSchema({
  name: "test-result",
  keys: () => ({}),
  extend: runResultSchema,
})
