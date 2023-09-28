/*
 * Copyright (C) 2018-2023 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import { Log } from "../../../logger/log-entry"
import { DeployState } from "../../../types/service"
import { KubernetesPluginContext } from "../config"
import { helm } from "../helm/helm-cli"
import { helmStatusMap } from "../helm/status"
import { getKubernetesSystemVariables } from "../init"

const releaseName = "garden-nginx"

export async function helmNginxStatus(ctx: KubernetesPluginContext, log: Log): Promise<DeployState> {
  const provider = ctx.provider
  const config = provider.config

  const namespace = config.gardenSystemNamespace

  try {
    const statusRes = JSON.parse(
      await helm({
        ctx,
        log,
        namespace,
        args: ["status", releaseName, "--output", "json"],
        // do not send JSON output to Garden Cloud or CLI verbose log
        emitLogEvents: false,
      })
    )
    const status = statusRes.info?.status || "unknown"
    log.debug(chalk.yellow(`Helm release status for ${releaseName}: ${status}`))
    return helmStatusMap[status] || "unknown"
  } catch (error) {
    log.warn(chalk.yellow(`Unable to get helm status for ${releaseName} release: ${error}`))
    return "unknown"
  }
}

export async function helmNginxInstall(ctx: KubernetesPluginContext, log: Log) {
  const provider = ctx.provider
  const config = provider.config

  const namespace = config.gardenSystemNamespace

  const status = await helmNginxStatus(ctx, log)

  if (status === "ready") {
    return
  }

  const systemVars = getKubernetesSystemVariables(config)

  const values = {
    name: "ingress-controller",
    controller: {
      kind: "DaemonSet",
      updateStrategy: {
        type: "RollingUpdate",
        rollingUpdate: {
          maxUnavailable: 1,
        },
      },
      hostPort: {
        enabled: true,
        ports: {
          http: systemVars["ingress-http-port"],
          https: systemVars["ingress-https-port"],
        },
      },
      minReadySeconds: 1,
      tolerations: systemVars["system-tolerations"],
      nodeSelector: systemVars["system-node-selector"],
      admissionWebhooks: {
        enabled: false,
      },
      ingressClassResource: {
        name: "nginx",
        enabled: true,
        default: true,
      },
    },
    defaultBackend: {
      enabled: true,
    },
  }

  // TODO-G2: update the nginx version
  const args = [
    "install",
    releaseName,
    "ingress-nginx",
    "--version",
    "4.0.13",
    "--repo",
    "https://kubernetes.github.io/ingress-nginx",
    "--namespace",
    namespace,
    "--timeout",
    "300s",
    "--set-json",
    JSON.stringify(values),
  ]

  log.info(`Installing nginx in ${namespace} namespace...`)

  await helm({ ctx, namespace, log, args, emitLogEvents: false })

  log.success(`nginx successfully installed in ${namespace} namespace`)
}

export async function helmNginxUninstall(ctx: KubernetesPluginContext, log: Log) {
  const provider = ctx.provider
  const config = provider.config

  const namespace = config.gardenSystemNamespace

  await helm({ ctx, namespace, log, args: ["uninstall", releaseName], emitLogEvents: false })
}
