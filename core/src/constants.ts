/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import env from "env-var"
import { join, resolve } from "path"
import { homedir } from "os"

export const isPkg = !!(<any>process).pkg

export const gitScanModes = ["repo", "subtree"] as const
export type GitScanMode = (typeof gitScanModes)[number]
export const defaultGitScanMode: GitScanMode = "subtree"

export const GARDEN_CORE_ROOT = isPkg ? resolve(process.execPath, "..") : resolve(__dirname, "..", "..")
export const GARDEN_CLI_ROOT = isPkg ? resolve(process.execPath, "..") : resolve(GARDEN_CORE_ROOT, "..", "cli")
export const STATIC_DIR = isPkg ? resolve(process.execPath, "..", "static") : resolve(GARDEN_CORE_ROOT, "..", "static")
export const DEFAULT_GARDEN_DIR_NAME = ".garden"
export const MUTAGEN_DIR_NAME = "mutagen"
export const LOGS_DIR_NAME = "logs"
export const GARDEN_GLOBAL_PATH = join(homedir(), DEFAULT_GARDEN_DIR_NAME)
export const ERROR_LOG_FILENAME = "error.log"
export const GARDEN_VERSIONFILE_NAME = ".garden-version"
export const DEFAULT_PORT_PROTOCOL = "TCP"

export enum GardenApiVersion {
  v0 = "garden.io/v0",
  v1 = "garden.io/v1",
}

export const DEFAULT_BUILD_TIMEOUT_SEC = 600
export const DEFAULT_TEST_TIMEOUT_SEC = 600
export const DEFAULT_RUN_TIMEOUT_SEC = 600
export const DEFAULT_DEPLOY_TIMEOUT_SEC = 300

export const SUPPORTED_PLATFORMS: NodeJS.Platform[] = ["linux", "darwin", "win32"]
export const SUPPORTED_ARCHITECTURES: NodeJS.Architecture[] = ["x64", "arm64"]

// These keys aren't sensitive, so we ask GitGuardian to ignore them.
export const SEGMENT_DEV_API_KEY = "D3DUZ3lBSDO3krnuIO7eYDdtlDAjooKW" // ggignore
export const SEGMENT_PROD_API_KEY = "b6ovUD9A0YjQqT3ZWetWUbuZ9OmGxKMa" // ggignore

export const DOCS_BASE_URL = "https://docs.garden.io"
export const VERSION_CHECK_URL = "https://get.garden.io/version"

export const DEFAULT_GARDEN_CLOUD_DOMAIN = "https://app.garden.io"

/**
 * Environment variables, with defaults where appropriate.
 *
 * We set this up as a map to facilitate overriding values in tests.
 */
export const gardenEnv = {
  ANALYTICS_DEV: env.get("ANALYTICS_DEV").required(false).asBool(),
  GARDEN_AUTH_TOKEN: env.get("GARDEN_AUTH_TOKEN").required(false).asString(),
  GARDEN_CACHE_TTL: env.get("GARDEN_CACHE_TTL").required(false).asInt(),
  GARDEN_DB_DIR: env.get("GARDEN_DB_DIR").required(false).default(GARDEN_GLOBAL_PATH).asString(),
  GARDEN_DISABLE_ANALYTICS: env.get("GARDEN_DISABLE_ANALYTICS").required(false).asBool(),
  GARDEN_DISABLE_PORT_FORWARDS: env.get("GARDEN_DISABLE_PORT_FORWARDS").required(false).asBool(),
  GARDEN_DISABLE_VERSION_CHECK: env.get("GARDEN_DISABLE_VERSION_CHECK").required(false).asBool(),
  GARDEN_ENABLE_PROFILING: env.get("GARDEN_ENABLE_PROFILING").required(false).default("false").asBool(),
  GARDEN_ENVIRONMENT: env.get("GARDEN_ENVIRONMENT").required(false).asString(),
  GARDEN_EXPERIMENTAL_BUILD_STAGE: env.get("GARDEN_EXPERIMENTAL_BUILD_STAGE").required(false).asBool(),
  GARDEN_GE_SCHEDULED: env.get("GARDEN_GE_SCHEDULED").required(false).asBool(),
  GARDEN_GIT_SCAN_MODE: env.get("GARDEN_GIT_SCAN_MODE").required(false).asEnum(gitScanModes),
  GARDEN_LEGACY_BUILD_STAGE: env.get("GARDEN_LEGACY_BUILD_STAGE").required(false).asBool(),
  GARDEN_LOG_LEVEL: env.get("GARDEN_LOG_LEVEL").required(false).asString(),
  GARDEN_LOGGER_TYPE: env.get("GARDEN_LOGGER_TYPE").required(false).asString(),
  GARDEN_PROXY_DEFAULT_ADDRESS: env.get("GARDEN_PROXY_DEFAULT_ADDRESS").required(false).asString(),
  GARDEN_SERVER_PORT: env.get("GARDEN_SERVER_PORT").required(false).asPortNumber(),
  GARDEN_SERVER_HOSTNAME: env.get("GARDEN_SERVER_HOSTNAME").required(false).asUrlString(),
  GARDEN_SKIP_TESTS: env.get("GARDEN_SKIP_TESTS").required(false).default("").asString(),
  GARDEN_HARD_CONCURRENCY_LIMIT: env.get("GARDEN_HARD_CONCURRENCY_LIMIT").required(false).default(50).asInt(),
  GARDEN_WORKFLOW_RUN_UID: env.get("GARDEN_WORKFLOW_RUN_UID").required(false).asString(),
  GARDEN_CLOUD_DOMAIN: env.get("GARDEN_CLOUD_DOMAIN").required(false).asUrlString(),
  GARDEN_ENABLE_TRACING: env.get("GARDEN_ENABLE_TRACING").required(false).default("true").asBool(),
}
