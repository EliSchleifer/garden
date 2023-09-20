/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import { mkdirp, writeFile } from "fs-extra"
import { load } from "js-yaml"
import { remove } from "lodash"
import moment from "moment"
import { join } from "path"
import { joi, joiProviderName } from "../../../config/common"
import { providerConfigBaseSchema } from "../../../config/provider"
import { ConfigurationError } from "../../../exceptions"
import { ConfigureProviderParams } from "../../../plugin/handlers/Provider/configureProvider"
import { dedent } from "../../../util/string"
import { KubernetesConfig, namespaceSchema } from "../config"
import { EPHEMERAL_KUBERNETES_PROVIDER_NAME } from "./ephemeral"

export const configSchema = () =>
  providerConfigBaseSchema()
    .keys({
      name: joiProviderName(EPHEMERAL_KUBERNETES_PROVIDER_NAME),
      namespace: namespaceSchema().description(
        "Specify which namespace to deploy services to (defaults to the project name). " +
          "Note that the framework generates other namespaces as well with this name as a prefix."
      ),
      setupIngressController: joi
        .string()
        .allow("nginx", false, null)
        .default("nginx")
        .description(
          dedent`Set this to null or false to skip installing/enabling the \`nginx\` ingress controller. Note: if you skip installing the \`nginx\` ingress controller for ephemeral cluster, your ingresses may not function properly.`
        ),
    })
    .description(`The provider configuration for the ${EPHEMERAL_KUBERNETES_PROVIDER_NAME} plugin.`)

export async function configureProvider(params: ConfigureProviderParams<KubernetesConfig>) {
  const { base, log, projectName, ctx, config: baseConfig } = params
  if (projectName === "garden-system") {
    // avoid configuring ephemeral-kubernetes provider and creating ephemeral-cluster for garden-system project
    return {
      config: baseConfig,
    }
  }
  log.info(`Configuring ${EPHEMERAL_KUBERNETES_PROVIDER_NAME} provider for project ${projectName}`)
  if (!ctx.cloudApi) {
    throw new ConfigurationError({
      message: `You are not logged in. You must be logged into Garden Cloud in order to use ${EPHEMERAL_KUBERNETES_PROVIDER_NAME} provider.`,
    })
  }
  if (ctx.cloudApi && ctx.cloudApi?.domain !== "https://app.garden.io") {
    throw new ConfigurationError({
      message: `${EPHEMERAL_KUBERNETES_PROVIDER_NAME} provider is currently not supported for ${ctx.cloudApi.distroName}.`,
    })
  }
  // creating tmp dir .garden/ephemeral-kubernetes for storing kubeconfig
  const ephemeralClusterDirPath = join(ctx.gardenDirPath, "ephemeral-kubernetes")
  await mkdirp(ephemeralClusterDirPath)
  log.info("Retrieving ephemeral Kubernetes cluster")
  const createEphemeralClusterResponse = await ctx.cloudApi.createEphemeralCluster()
  const clusterId = createEphemeralClusterResponse.instanceMetadata.instanceId
  log.info(`Ephemeral Kubernetes cluster retrieved successfully`)
  const deadlineDateTime = moment(createEphemeralClusterResponse.instanceMetadata.deadline)
  const diffInNowAndDeadline = moment.duration(deadlineDateTime.diff(moment())).asMinutes().toFixed(1)
  log.info(
    chalk.white(
      `Ephemeral cluster will be destroyed in ${diffInNowAndDeadline} minutes, at ${deadlineDateTime.format(
        "YYYY-MM-DD HH:mm:ss"
      )}`
    )
  )
  log.info("Fetching kubeconfig for the ephemeral cluster")
  const kubeConfig = await ctx.cloudApi.getKubeConfigForCluster(clusterId)
  const kubeconfigFileName = `${clusterId}-kubeconfig.yaml`
  const kubeConfigPath = join(ctx.gardenDirPath, "ephemeral-kubernetes", kubeconfigFileName)
  await writeFile(kubeConfigPath, kubeConfig)
  log.info(`Kubeconfig for ephemeral cluster saved at path: ${chalk.underline(kubeConfigPath)}`)

  const parsedKubeConfig: any = load(kubeConfig)
  const currentContext = parsedKubeConfig["current-context"]
  baseConfig.context = currentContext
  baseConfig.kubeconfig = kubeConfigPath

  // set deployment registry
  baseConfig.deploymentRegistry = {
    hostname: createEphemeralClusterResponse.registry.endpointAddress,
    namespace: createEphemeralClusterResponse.registry.repository,
    insecure: false,
  }
  // set imagePullSecrets
  baseConfig.imagePullSecrets = [
    {
      name: createEphemeralClusterResponse.registry.imagePullSecret.name,
      namespace: createEphemeralClusterResponse.registry.imagePullSecret.namespace,
    },
  ]
  // set build mode to kaniko
  baseConfig.buildMode = "kaniko"
  // set additional kaniko flags
  baseConfig.kaniko = {
    extraFlags: [
      `--registry-mirror=${createEphemeralClusterResponse.registry.endpointAddress}`,
      `--registry-mirror=${createEphemeralClusterResponse.registry.dockerRegistryMirror}`,
      "--insecure-pull",
      "--force",
    ],
  }
  // set setupIngressController to null while initializing kubernetes plugin
  // as we use it later and configure it separately for ephemeral-kubernetes
  const kubernetesPluginConfig = {
    ...params,
    config: {
      ...baseConfig,
      setupIngressController: null,
    },
  }
  let { config: updatedConfig } = await base!(kubernetesPluginConfig)

  // setup ingress controller unless setupIngressController is set to false/null in provider config
  if (baseConfig.setupIngressController) {
    const _systemServices = updatedConfig._systemServices
    const nginxServices = ["ingress-controller", "default-backend"]
    remove(_systemServices, (s) => nginxServices.includes(s))
    _systemServices.push("nginx-ephemeral")
    updatedConfig.setupIngressController = "nginx"
    // set default hostname
    updatedConfig.defaultHostname = createEphemeralClusterResponse.ingressesHostname
  }

  return {
    config: updatedConfig,
  }
}
