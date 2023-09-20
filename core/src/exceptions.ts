/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { isString, trimEnd } from "lodash"
import { SpawnOpts, getGitHubIssueLink, testFlags } from "./util/util"
import dedent from "dedent"
import chalk from "chalk"
import stripAnsi from "strip-ansi"
import { Cycle } from "./graph/common"
import indentString from "indent-string"
import { constants } from "os"

// See https://nodejs.org/api/os.html#error-constants
type NodeJSErrnoErrors = typeof constants.errno
export type NodeJSErrnoErrorCodes = keyof NodeJSErrnoErrors

const errnoErrorCodeSet = new Set(Object.keys(constants.errno))

/**
 * NodeJS native errors with a code property.
 */
export type NodeJSErrnoException = NodeJS.ErrnoException & {
  code: NodeJSErrnoErrorCodes
  errno: number
}

export type EAddrInUseException = NodeJSErrnoException & {
  code: "EADDRINUSE"
  syscall: string
  address: string
  port: number
}

export function isErrnoException(err: any): err is NodeJSErrnoException {
  return typeof err.code === "string" && typeof err.errno === "number" && errnoErrorCodeSet.has(err.code)
}

export function isEAddrInUseException(err: any): err is EAddrInUseException {
  return isErrnoException(err) && err.code === "EADDRINUSE"
}

export type StackTraceMetadata = {
  functionName: string
  relativeFileName?: string
  lineNumber?: number
}

export type GardenErrorStackTrace = {
  metadata: StackTraceMetadata[]
  wrappedMetadata?: StackTraceMetadata[][]
}

export interface GardenErrorParams {
  message: string
  readonly stack?: string
  readonly wrappedErrors?: GardenError[]

  /**
   * The type of task, if the error was thrown as part of resolving or executing a node in the stack graph.
   */
  readonly taskType?: string

  readonly code?: NodeJSErrnoErrorCodes
}

export abstract class GardenError extends Error {
  /**
   * The error type will be used for rendering the error to json, and also for analytics.
   */
  abstract type: string

  /**
   * The type of task, if the error was thrown as part of resolving or executing a node in the stack graph.
   */
  public taskType?: string

  /**
   * If there was an underlying NodeJSErrnoException, the error code
   */
  public code?: NodeJSErrnoErrorCodes

  public override message: string
  public wrappedErrors?: GardenError[]

  constructor({ message, stack, wrappedErrors, taskType, code }: GardenErrorParams) {
    super(message.trim())
    this.stack = stack || this.stack
    this.wrappedErrors = wrappedErrors
    this.taskType = taskType
    this.code = code
  }

  override toString(verbose: boolean = false): string {
    if (verbose || testFlags.expandErrors) {
      const errorDetails = `${this.stack || this.message}\n\nError type: ${this.type}${
        this.code ? `\nUnderlying error code: ${this.code}` : ""
      }
`

      if (this.wrappedErrors) {
        return dedent`
          ${errorDetails}

          Wrapped errors:
          ${this.wrappedErrors?.map(
            (e) => dedent`
            ⮑ ${indentString(e.toString(verbose), 3).trim()}

          `
          )}
        `
      } else {
        return errorDetails
      }
    } else {
      return super.toString()
    }
  }

  /**
   * Returns string with ANSI-formatting that will be used to present the error to the user on the terminal.
   *
   * Can be overridden by subclasses to customize the error message rendering.
   *
   * @param context A string to provide additional context to the error message.
   *                Used in subclasses but ignored in the base class.
   * @returns A string with ANSI-formatting.
   */
  explain(_context?: string): string {
    return chalk.red(this.message)
  }

  toJSON() {
    return {
      type: this.type,
      taskType: this.taskType,
      code: this.code,
      message: this.message,
      stack: this.stack,
      wrappedErrors: this.wrappedErrors,
    }
  }
}

export class BuildError extends GardenError {
  type = "build"
}

export class ConfigurationError extends GardenError {
  type = "configuration"
}

type CircularDependenciesErrorParams = {
  messagePrefix: string
  cycles: Cycle[]
  cyclesSummary: string
}

export class CircularDependenciesError extends ConfigurationError {
  private _messagePrefix: string
  cycles: Cycle[]
  cyclesSummary: string

  constructor({ messagePrefix, cycles, cyclesSummary }: CircularDependenciesErrorParams) {
    super({ message: CircularDependenciesError.constructMessage(messagePrefix, cyclesSummary) })
    this._messagePrefix = messagePrefix
    this.cycles = cycles
    this.cyclesSummary = cyclesSummary
  }

  set messagePrefix(newMessagePrefix: string) {
    this._messagePrefix = newMessagePrefix
    this.message = CircularDependenciesError.constructMessage(newMessagePrefix, this.cyclesSummary)
  }

  get messagePrefix(): string {
    return this._messagePrefix
  }

  private static constructMessage(messagePrefix: string, cyclesSummary: string) {
    return `${messagePrefix}:\n\n${cyclesSummary}`
  }
}

export class CommandError extends GardenError {
  type = "command"
}

export class FilesystemError extends GardenError {
  type = "filesystem"
}

export class ValidationError extends GardenError {
  type = "validation"
}

export class PluginError extends GardenError {
  type = "plugin"
}

export class ParameterError extends GardenError {
  type = "parameter"
}

export class NotImplementedError extends GardenError {
  type = "not-implemented"
}

export class DeploymentError extends GardenError {
  type = "deployment"
}

export class RuntimeError extends GardenError {
  type = "runtime"
}

export class GraphError extends GardenError {
  type = "graph"
}

export class TimeoutError extends GardenError {
  type = "timeout"
}

export class NotFoundError extends GardenError {
  type = "not-found"
}

interface WorkflowScriptErrorDetails {
  output: string
  exitCode: number
  stdout: string
  stderr: string
}

export class WorkflowScriptError extends GardenError {
  type = "workflow-script"

  details: WorkflowScriptErrorDetails

  constructor(details: WorkflowScriptErrorDetails) {
    super({
      message: dedent`
      Script exited with code ${details.exitCode}. This is the output:

      ${details.stderr || details.output}`,
    })
    this.details = details
  }
}

export class CloudApiError extends GardenError {
  type = "cloud-api"

  responseStatusCode: number | undefined

  constructor(params: GardenErrorParams & { responseStatusCode?: number }) {
    super(params)
    this.responseStatusCode = params.responseStatusCode
  }
}

export class TemplateStringError extends GardenError {
  type = "template-string"
}

interface GenericGardenErrorParams extends GardenErrorParams {
  type: string
}

export class GenericGardenError extends GardenError {
  type: string

  constructor(params: GenericGardenErrorParams) {
    super(params)
    this.type = params.type
  }
}

type ChildProcessErrorDetails = {
  cmd: string
  args: string[]
  code: number
  output: string
  stderr: string
  stdout: string
  opts?: SpawnOpts
}

export class ChildProcessError extends GardenError {
  type = "childprocess"

  // The details do not need to be exposed in toString() or toJSON(), because they are included in the message.
  readonly details: ChildProcessErrorDetails

  constructor(details: ChildProcessErrorDetails) {
    super({ message: ChildProcessError.formatMessage(details) })
    this.details = details
  }

  private static formatMessage({ cmd, args, code, output, stderr }: ChildProcessErrorDetails): string {
    const nLinesToShow = 100
    const lines = output.split("\n")
    const out = lines.slice(-nLinesToShow).join("\n")
    const cmdStr = args.length > 0 ? `${cmd} ${args.join(" ")}` : cmd
    let msg = dedent`
      Command "${cmdStr}" failed with code ${code}:

      ${trimEnd(stderr, "\n")}
    `
    if (output && output !== stderr) {
      msg +=
        lines.length > nLinesToShow
          ? `\n\nHere are the last ${nLinesToShow} lines of the output:`
          : `\n\nHere's the full output:`
      msg += `\n\n${trimEnd(out, "\n")}`
    }
    return msg
  }
}

/**
 * Throw this error only when this error condition is definitely a Garden bug.
 *
 * Examples where throwing this error is appropriate:
 * - A Javascript TypeError has occurred, e.g. reading property on undefined.
 * - "This should not happen" kind of situations, e.g. internal data structures are in an invalid state.
 * - An unhandled exception has been thrown by a library. If you don't know what to do with this exception and it is most likely not due to user error, wrap it with "InternalError".
 *
 * In case the network is involved, we should *not* use the "InternalError", because that's usually a situation that the user needs to resolve.
 */
export class InternalError extends GardenError {
  // we want it to be obvious in amplitude data that this is not a normal error condition
  type = "crash"

  // not using object destructuring here on purpose, because errors are of type any and then the error might be passed as the params object accidentally.
  static wrapError(error: Error | string | any, prefix?: string): InternalError {
    let message: string | undefined
    let stack: string | undefined
    let code: NodeJSErrnoErrorCodes | undefined

    if (isErrnoException(error)) {
      message = error.message
      stack = error.stack
      code = error.code
    } else if (error instanceof Error) {
      message = error.message
      stack = error.stack
    } else if (isString(error)) {
      message = error
    } else if (error) {
      message = error["message"]
      stack = error["stack"]
    }

    message = message ? stripAnsi(message) : ""

    return new InternalError({ message: prefix ? `${stripAnsi(prefix)}: ${message}` : message, stack, code })
  }

  override explain(context?: string): string {
    let bugReportInformation = this.stack || this.message

    if (context) {
      bugReportInformation = `${stripAnsi(context)}\n${bugReportInformation}`
    }

    const header = "Encountered an unexpected Garden error. This is likely a bug 🍂"
    const body = dedent`
      You can help by reporting this on GitHub: ${getGitHubIssueLink(`Crash: ${this.message}`, "crash")}

      Please attach the following information to the bug report after making sure that the error message does not contain sensitive information:
    `

    return chalk.red(`${chalk.bold(header)}\n\n${body}\n\n${chalk.gray(bugReportInformation)}`)
  }
}

export function toGardenError(err: Error | GardenError | string | any): GardenError {
  if (err instanceof GardenError) {
    return err
  } else {
    return InternalError.wrapError(err)
  }
}

function getStackTraceFromString(stack: string): StackTraceMetadata[] {
  // Care about the first line matching our code base
  const lines = stack.split("\n").slice(1)

  return lines.flatMap((l) => {
    // match and extract any line from a stack trace with
    // function, file path, line number, column number
    // we are only interested in the first two for now
    const atLine = l.match(/at (?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/)

    // ignore this if there is no regex match
    if (!atLine) {
      return []
    }

    const functionName: string = atLine[1] || "<unknown>"
    const filePath = atLine[2] || ""
    let lastFilePos = -1
    let tmpPos = -1

    // Get the slice offset assuming the file path contains a known
    // path component in the source file path.
    if ((tmpPos = filePath.lastIndexOf("src")) > -1) {
      lastFilePos = tmpPos + 4
    } else if ((tmpPos = filePath.lastIndexOf("node_modules")) > -1) {
      lastFilePos = tmpPos + 13
    } else if ((tmpPos = filePath.lastIndexOf("node:internal")) > -1) {
      lastFilePos = tmpPos + 14
    }

    let relativeFileName: string | undefined = undefined

    if (lastFilePos > -1) {
      relativeFileName = filePath.slice(lastFilePos)
    }

    let lineNumber = parseInt(atLine[3], 10) || -1

    return [
      {
        functionName,
        relativeFileName,
        lineNumber,
      },
    ]
  })
}

export function getStackTraceMetadata(error: GardenError): GardenErrorStackTrace {
  if (!error.stack && !error.wrappedErrors) {
    return { metadata: [], wrappedMetadata: undefined }
  }

  const errorMetadata: StackTraceMetadata[] = error.stack ? getStackTraceFromString(error.stack) : []

  const wrappedMetadata: StackTraceMetadata[][] | undefined = error.wrappedErrors?.map((wrappedError) => {
    if (!wrappedError.stack) {
      return []
    }

    return getStackTraceFromString(wrappedError.stack)
  })

  return {
    metadata: errorMetadata,
    wrappedMetadata,
  }
}
