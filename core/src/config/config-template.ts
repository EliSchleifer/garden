/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { joi, joiUserIdentifier, CustomObjectSchema, createSchema, unusedApiVersionSchema } from "./common"
import { baseModuleSpecSchema, BaseModuleSpec } from "./module"
import { dedent, naturalList } from "../util/string"
import { configTemplateKind, renderTemplateKind, BaseGardenResource, baseInternalFieldsSchema } from "./base"
import { resolveTemplateStrings } from "../template-string/template-string"
import { validateConfig } from "./validation"
import { Garden } from "../garden"
import { ConfigurationError } from "../exceptions"
import { resolve, posix, dirname } from "path"
import { readFile } from "fs-extra"
import { ProjectConfigContext } from "./template-contexts/project"
import { ActionConfig, actionKinds } from "../actions/types"
import { WorkflowConfig } from "./workflow"

const inputTemplatePattern = "${inputs.*}"
const parentNameTemplate = "${parent.name}"
const templateNameTemplate = "${template.name}"
const templateReferenceUrl = "./template-strings/README.md"
const moduleTemplateReferenceUrl = "./template-strings/modules.md"

export const templateNoTemplateFields = ["apiVersion", "kind"]
export const templatableKinds = [...actionKinds, "Workflow"]

// Note: Deliberately excludes Modules, which are kept in a different flow
export type TemplatableConfig = ActionConfig | WorkflowConfig
export type TemplatableConfigWithPath = TemplatableConfig & { path?: string }

export type ConfigTemplateKind = typeof configTemplateKind

interface TemplatedModuleSpec extends Partial<BaseModuleSpec> {
  type: string
}

export interface ConfigTemplateResource extends BaseGardenResource {
  inputsSchemaPath?: string
  modules?: TemplatedModuleSpec[]
  configs?: TemplatableConfigWithPath[]
}

export interface ConfigTemplateConfig extends ConfigTemplateResource {
  inputsSchema: CustomObjectSchema
}

export async function resolveConfigTemplate(
  garden: Garden,
  resource: ConfigTemplateResource
): Promise<ConfigTemplateConfig> {
  // Resolve template strings, minus module templates and files
  const partial = {
    ...resource,
    modules: [],
    configs: [],
  }
  const loggedIn = garden.isLoggedIn()
  const enterpriseDomain = garden.cloudApi?.domain
  const context = new ProjectConfigContext({ ...garden, loggedIn, enterpriseDomain })
  const resolved = resolveTemplateStrings({ value: partial, context, source: { yamlDoc: resource.internal.yamlDoc } })
  const configPath = resource.internal.configFilePath

  // Validate the partial config
  const validated = validateConfig({
    config: resolved,
    schema: configTemplateSchema(),
    projectRoot: garden.projectRoot,
    yamlDocBasePath: [],
  })

  // Read and validate the JSON schema, if specified
  // -> default to any object
  let inputsJsonSchema = {
    type: "object",
    additionalProperties: true,
  }

  const configDir = configPath ? dirname(configPath) : resource.internal.basePath

  if (validated.inputsSchemaPath) {
    const path = resolve(configDir, ...validated.inputsSchemaPath.split(posix.sep))
    try {
      inputsJsonSchema = JSON.parse((await readFile(path)).toString())
    } catch (error) {
      throw new ConfigurationError({
        message: `Unable to read inputs schema at '${validated.inputsSchemaPath}' for ${configTemplateKind} ${validated.name}: ${error}`,
      })
    }

    const type = inputsJsonSchema?.type

    if (type !== "object") {
      throw new ConfigurationError({
        message: `Inputs schema at '${validated.inputsSchemaPath}' for ${configTemplateKind} ${validated.name} has type ${type}, but should be "object".`,
      })
    }
  }

  // Add the module templates back and return
  return {
    ...validated,
    inputsSchema: joi.object().jsonSchema(inputsJsonSchema),
    modules: resource.modules,
    configs: resource.configs,
  }
}

export const configTemplateSchema = createSchema({
  name: configTemplateKind,
  keys: () => ({
    apiVersion: unusedApiVersionSchema(),
    kind: joi.string().allow(configTemplateKind, "ModuleTemplate").only().default(configTemplateKind),
    name: joiUserIdentifier().description("The name of the template."),

    internal: baseInternalFieldsSchema,

    inputsSchemaPath: joi
      .posixPath()
      .relativeOnly()
      .description(
        "Path to a JSON schema file describing the expected inputs for the template. Must be an object schema. If none is provided all inputs will be accepted."
      ),
    // TODO: remove in 0.14
    modules: joi
      .array()
      .items(moduleSchema())
      .description(
        dedent`
        A list of modules this template will output. The schema for each is the same as when you create modules normally in configuration files, with the addition of a \`path\` field, which allows you to specify a sub-directory to set as the module root.

        In addition to any template strings you can normally use for modules (see [the reference](${moduleTemplateReferenceUrl})), you can reference the inputs described by the inputs schema for the template, using ${inputTemplatePattern} template strings, as well as ${parentNameTemplate} and ${templateNameTemplate}, to reference the name of the module using the template, and the name of the template itself, respectively. This also applies to file contents specified under the \`files\` key.

        **Important: Make sure you use templates for any identifiers that must be unique, such as module names, service names and task names. Otherwise you'll inevitably run into configuration errors. The module names can reference the ${inputTemplatePattern}, ${parentNameTemplate} and ${templateNameTemplate} keys. Other identifiers can also reference those, plus any other keys available for module templates (see [the module context reference](${moduleTemplateReferenceUrl})).**
        `
      ),
    configs: joi
      .array()
      .items(templatedResourceSchema())
      .description(
        dedent`
        A list of Garden configs this template will output, e.g. a set of actions. The schema for each is the same as when you create resources normally in configuration files, with the addition of a \`path\` field, which allows you to specify a sub-directory to set as the root location of the resource.

        The following resource kinds are allowed: ${naturalList(templatableKinds.map((f) => "`" + f + "`"))}

        __Note that you may _not_ specify Module resources here. Those need to be specified in the \`modules\` field.__

        In addition to any template strings you can normally use for the given configurations (see [the reference](${templateReferenceUrl})), you can reference the inputs described by the inputs schema for the template, using ${inputTemplatePattern} template strings, as well as ${parentNameTemplate} and ${templateNameTemplate}, to reference the name of the \`${renderTemplateKind}\` resource being rendered, and the name of the template itself, respectively.

        **Important: Make sure you use templates for any identifiers that must be unique, such as action names.**
        Otherwise you'll inevitably run into configuration errors when re-using the template. The names can reference the ${inputTemplatePattern}, ${parentNameTemplate} and ${templateNameTemplate} keys, and must be resolvable when parsing the template (meaning no action or runtime references etc.). Other identifiers can also reference those, plus any other keys available for templates in the given configs (see [the reference](${templateReferenceUrl})).

        Also note that template strings are not allowed in the following fields: ${naturalList(
          templateNoTemplateFields.map((f) => "`" + f + "`")
        )}
        `
      ),
  }),
})

const moduleSchema = createSchema({
  name: "module",
  extend: baseModuleSpecSchema,
  keys: () => ({
    path: joi
      .posixPath()
      .relativeOnly()
      .subPathOnly()
      .description(
        "POSIX-style path of a sub-directory to set as the module root. If the directory does not exist, it is automatically created."
      ),
  }),
})

// Note: Further validation is performed with more specific schemas after parsing
const templatedResourceSchema = createSchema({
  name: "templated-resource",
  keys: () => ({
    apiVersion: unusedApiVersionSchema(),
    kind: joi
      .string()
      .allow(...templatableKinds)
      .only()
      .description("The kind of resource to create."),
    name: joiUserIdentifier().description("The name of the resource."),
    unknown: true,
  }),
})
