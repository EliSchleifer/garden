---
title: "`kubernetes` Deploy"
tocTitle: "`kubernetes` Deploy"
---

# `kubernetes` Deploy

## Description

Specify one or more Kubernetes manifests to deploy.

You can either (or both) specify the manifests as part of the `garden.yml` configuration, or you can refer to one or more files with existing manifests.

Note that if you include the manifests in the `garden.yml` file, you can use [template strings](https://docs.garden.io/using-garden/variables-and-templating) to interpolate values into the manifests.

If you need more advanced templating features you can use the [helm](./helm.md) Deploy type.

Below is the full schema reference for the action. For an introduction to configuring Garden, please look at our [Configuration
guide](../../../using-garden/configuration-overview.md).

The [first section](#complete-yaml-schema) contains the complete YAML schema, and the [second section](#configuration-keys) describes each schema key.

`kubernetes` actions also export values that are available in template strings. See the [Outputs](#outputs) section below for details.

## Complete YAML Schema

The values in the schema below are the default values.

```yaml
# The type of action, e.g. `exec`, `container` or `kubernetes`. Some are built into Garden but mostly these will be
# defined by your configured providers.
type:

# A valid name for the action. Must be unique across all actions of the same _kind_ in your project.
name:

# A description of the action.
description:

# By default, the directory where the action is defined is used as the source for the build context.
#
# You can override this by setting either `source.path` to another (POSIX-style) path relative to the action source
# directory, or `source.repository` to get the source from an external repository.
#
# If using `source.path`, you must make sure the target path is in a git repository.
#
# For `source.repository` behavior, please refer to the [Remote Sources
# guide](https://docs.garden.io/advanced/using-remote-sources).
source:
  # A relative POSIX-style path to the source directory for this action. You must make sure this path exists and is in
  # a git repository!
  path:

  # When set, Garden will import the action source from this repository, but use this action configuration (and not
  # scan for configs in the separate repository).
  repository:
    # A remote repository URL. Currently only supports git servers. Must contain a hash suffix pointing to a specific
    # branch or tag, with the format: <git remote url>#<branch|tag>
    url:

# A list of other actions that this action depends on, and should be built, deployed or run (depending on the action
# type) before processing this action.
#
# Each dependency should generally be expressed as a `"<kind>.<name>"` string, where _<kind>_ is one of `build`,
# `deploy`, `run` or `test`, and _<name>_ is the name of the action to depend on.
#
# You may also optionally specify a dependency as an object, e.g. `{ kind: "Build", name: "some-image" }`.
#
# Any empty values (i.e. null or empty strings) are ignored, so that you can conditionally add in a dependency via
# template expressions.
dependencies: []

# Set this to `true` to disable the action. You can use this with conditional template strings to disable actions
# based on, for example, the current environment or other variables (e.g. `disabled: ${environment.name == "prod"}`).
# This can be handy when you only need certain actions for specific environments, e.g. only for development.
#
# For Build actions, this means the build is not performed _unless_ it is declared as a dependency by another enabled
# action (in which case the Build is assumed to be necessary for the dependant action to be run or built).
#
# For other action kinds, the action is skipped in all scenarios, and dependency declarations to it are ignored. Note
# however that template strings referencing outputs (i.e. runtime outputs) will fail to resolve when the action is
# disabled, so you need to make sure to provide alternate values for those if you're using them, using conditional
# expressions.
disabled: false

# Specify a list of POSIX-style paths or globs that should be regarded as source files for this action, and thus will
# affect the computed _version_ of the action.
#
# For actions other than _Build_ actions, this is usually not necessary to specify, or is implicitly inferred. An
# exception would be e.g. an `exec` action without a `build` reference, where the relevant files cannot be inferred
# and you want to define which files should affect the version of the action, e.g. to make sure a Test action is run
# when certain files are modified.
#
# _Build_ actions have a different behavior, since they generally are based on some files in the source tree, so
# please reference the docs for more information on those.
#
# Note that you can also _exclude_ files using the `exclude` field or by placing `.gardenignore` files in your source
# tree, which use the same format as `.gitignore` files. See the [Configuration Files
# guide](https://docs.garden.io/using-garden/configuration-overview#including-excluding-files-and-directories) for
# details.
include:

# Specify a list of POSIX-style paths or glob patterns that should be explicitly excluded from the action's version.
#
# For actions other than _Build_ actions, this is usually not necessary to specify, or is implicitly inferred. For
# _Deploy_, _Run_ and _Test_ actions, the exclusions specified here only applied on top of explicitly set `include`
# paths, or such paths inferred by providers. See the [Configuration Files
# guide](https://docs.garden.io/using-garden/configuration-overview#including-excluding-files-and-directories) for
# details.
#
# Unlike the `scan.exclude` field in the project config, the filters here have _no effect_ on which files and
# directories are watched for changes when watching is enabled. Use the project `scan.exclude` field to affect those,
# if you have large directories that should not be watched for changes.
exclude:

# A map of variables scoped to this particular action. These are resolved before any other parts of the action
# configuration and take precedence over group-scoped variables (if applicable) and project-scoped variables, in that
# order. They may reference group-scoped and project-scoped variables, and generally can use any template strings
# normally allowed when resolving the action.
variables:

# Specify a list of paths (relative to the directory where the action is defined) to a file containing variables, that
# we apply on top of the action-level `variables` field, and take precedence over group-level variables (if
# applicable) and project-level variables, in that order.
#
# If you specify multiple paths, they are merged in the order specified, i.e. the last one takes precedence over the
# previous ones.
#
# The format of the files is determined by the configured file's extension:
#
# * `.env` - Standard "dotenv" format, as defined by [dotenv](https://github.com/motdotla/dotenv#rules).
# * `.yaml`/`.yml` - YAML. The file must consist of a YAML document, which must be a map (dictionary). Keys may
# contain any value type.
# * `.json` - JSON. Must contain a single JSON _object_ (not an array).
#
# _NOTE: The default varfile format will change to YAML in Garden v0.13, since YAML allows for definition of nested
# objects and arrays._
#
# To use different varfiles in different environments, you can template in the environment name to the varfile name,
# e.g. `varfile: "my-action.\$\{environment.name\}.env` (this assumes that the corresponding varfiles exist).
#
# If a listed varfile cannot be found, it is ignored.
varfiles: []

# Specify a _Build_ action, and resolve this action from the context of that Build.
#
# For example, you might create an `exec` Build which prepares some manifests, and then reference that in a
# `kubernetes` _Deploy_ action, and the resulting manifests from the Build.
#
# This would mean that instead of looking for manifest files relative to this action's location in your project
# structure, the output directory for the referenced `exec` Build would be the source.
build:

kind:

# Timeout for the deploy to complete, in seconds.
timeout: 300

spec:
  # POSIX-style paths to YAML files to load manifests from. Each can contain multiple manifests, and can include any
  # Garden template strings, which will be resolved before applying the manifests.
  files: []

  # Resolve the specified kustomization and include the resulting resources. Note that if you specify `files` or
  # `manifests` as well, these are also included.
  kustomize:
    # The directory path where the desired kustomization.yaml is, or a git repository URL. This could be the path to
    # an overlay directory, for example. If it's a path, must be a relative POSIX-style path and must be within the
    # action root. Defaults to the action root. If you set this to null, kustomize will not be run.
    path: .

    # A list of additional arguments to pass to the `kustomize build` command. Note that specifying '-o' or '--output'
    # is not allowed.
    extraArgs: []

  # List of Kubernetes resource manifests to deploy. If `files` is also specified, this is combined with the manifests
  # read from the files.
  manifests:
    - # The API version of the resource.
      apiVersion:

      # The kind of the resource.
      kind:

      metadata:
        # The name of the resource.
        name:

  # A valid Kubernetes namespace name. Must be a valid RFC1035/RFC1123 (DNS) label (may contain lowercase letters,
  # numbers and dashes, must start with a letter, and cannot end with a dash) and must not be longer than 63
  # characters.
  namespace:

  # Manually specify port forwards that Garden should set up when deploying in dev or watch mode. If specified, these
  # override the auto-detection of forwardable ports, so you'll need to specify the full list of port forwards to
  # create.
  portForwards:
    - # An identifier to describe the port forward.
      name:

      # The full resource kind and name to forward to, e.g. Service/my-service or Deployment/my-deployment. Note that
      # Garden will not validate this ahead of attempting to start the port forward, so you need to make sure this is
      # correctly set. The types of resources supported will match that of the `kubectl port-forward` CLI command.
      resource:

      # The port number on the remote resource to forward to.
      targetPort:

      # The _preferred_ local port to forward from. If none is set, a random port is chosen. If the specified port is
      # not available, a warning is shown and a random port chosen instead.
      localPort:

  # The maximum duration (in seconds) to wait for resources to deploy and become healthy.
  timeout: 300

  # Wait until the jobs have been completed. Garden will wait for as long as `timeout`.
  waitForJobs: false

  # Specify a default resource in the deployment to use for syncs, local mode, and for the `garden exec` command.
  #
  # Specify either `kind` and `name`, or a `podSelector`. The resource should be one of the resources deployed by this
  # action (otherwise the target is not guaranteed to be deployed with adjustments required for syncing or local
  # mode).
  #
  # Set `containerName` to specify a container to connect to in the remote Pod. By default the first container in the
  # Pod is used.
  #
  # Note that if you specify `podSelector` here, it is not validated to be a selector matching one of the resources
  # deployed by the action.
  defaultTarget:
    # The kind of Kubernetes resource to find.
    kind:

    # The name of the resource, of the specified `kind`. If specified, you must also specify `kind`.
    name:

    # A map of string key/value labels to match on any Pods in the namespace. When specified, a random ready Pod with
    # matching labels will be picked as a target, so make sure the labels will always match a specific Pod type.
    podSelector:

    # The name of a container in the target. Specify this if the target contains more than one container and the main
    # container is not the first container in the spec.
    containerName:

  # Configure path syncs for the resources in this Deploy.
  #
  # If you have multiple syncs for the Deploy, you can use the `defaults` field to set common configuration for every
  # individual sync.
  sync:
    # Defaults to set across every sync for this Deploy. If you use the `exclude` field here, it will be merged with
    # any excludes set in individual syncs. These are applied on top of any defaults set in the provider
    # configuration.
    defaults:
      # Specify a list of POSIX-style paths or glob patterns that should be excluded from the sync.
      #
      # Any exclusion patterns defined in individual sync specs will be applied in addition to these patterns.
      #
      # `.git` directories and `.garden` directories are always ignored.
      exclude:

      # The default permission bits, specified as an octal, to set on files at the sync target. Defaults to 0o644
      # (user can read/write, everyone else can read). See the [Mutagen
      # docs](https://mutagen.io/documentation/synchronization/permissions#permissions) for more information.
      fileMode: 420

      # The default permission bits, specified as an octal, to set on directories at the sync target. Defaults to
      # 0o755 (user can read/write, everyone else can read). See the [Mutagen
      # docs](https://mutagen.io/documentation/synchronization/permissions#permissions) for more information.
      directoryMode: 493

      # Set the default owner of files and directories at the target. Specify either an integer ID or a string name.
      # See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#owners-and-groups) for
      # more information.
      owner:

      # Set the default group on files and directories at the target. Specify either an integer ID or a string name.
      # See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#owners-and-groups) for
      # more information.
      group:

    # A list of syncs to start once the Deploy is successfully started.
    paths:
      - # The Kubernetes resource to sync to. If specified, this is used instead of `spec.defaultTarget`.
        target:
          # The kind of Kubernetes resource to find.
          kind:

          # The name of the resource, of the specified `kind`. If specified, you must also specify `kind`.
          name:

          # A map of string key/value labels to match on any Pods in the namespace. When specified, a random ready Pod
          # with matching labels will be picked as a target, so make sure the labels will always match a specific Pod
          # type.
          podSelector:

          # The name of a container in the target. Specify this if the target contains more than one container and the
          # main container is not the first container in the spec.
          containerName:

        # The local path to sync from, either absolute or relative to the source directory where the Deploy action is
        # defined.
        #
        # This should generally be a templated path to another action's source path (e.g.
        # `${actions.build.my-container-image.sourcePath}`), or a relative path. If a path is hard-coded, you must
        # make sure the path exists, and that it is reliably the correct path for every user.
        sourcePath: .

        # POSIX-style absolute path to sync to inside the container. The root path (i.e. "/") is not allowed.
        containerPath:

        # Specify a list of POSIX-style paths or glob patterns that should be excluded from the sync.
        #
        # `.git` directories and `.garden` directories are always ignored.
        exclude:

        # The sync mode to use for the given paths. See the [Code Synchronization
        # guide](https://docs.garden.io/guides/code-synchronization) for details.
        mode: one-way-safe

        # The default permission bits, specified as an octal, to set on files at the sync target. Defaults to 0o644
        # (user can read/write, everyone else can read). See the [Mutagen
        # docs](https://mutagen.io/documentation/synchronization/permissions#permissions) for more information.
        defaultFileMode: 420

        # The default permission bits, specified as an octal, to set on directories at the sync target. Defaults to
        # 0o755 (user can read/write, everyone else can read). See the [Mutagen
        # docs](https://mutagen.io/documentation/synchronization/permissions#permissions) for more information.
        defaultDirectoryMode: 493

        # Set the default owner of files and directories at the target. Specify either an integer ID or a string name.
        # See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#owners-and-groups) for
        # more information.
        defaultOwner:

        # Set the default group on files and directories at the target. Specify either an integer ID or a string name.
        # See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#owners-and-groups) for
        # more information.
        defaultGroup:

    # Overrides for the container command and/or arguments for when in sync mode.
    overrides:
      - # The Kubernetes resources to override. If specified, this is used instead of `spec.defaultTarget`.
        target:
          # The kind of Kubernetes resource to find.
          kind:

          # The name of the resource, of the specified `kind`. If specified, you must also specify `kind`.
          name:

          # A map of string key/value labels to match on any Pods in the namespace. When specified, a random ready Pod
          # with matching labels will be picked as a target, so make sure the labels will always match a specific Pod
          # type.
          podSelector:

          # The name of a container in the target. Specify this if the target contains more than one container and the
          # main container is not the first container in the spec.
          containerName:

        # Override the command/entrypoint in the matched container.
        command:

        # Override the args in the matched container.
        args:

  # [EXPERIMENTAL] Configures the local application which will send and receive network requests instead of the target
  # resource specified by `localMode.target` or `defaultTarget`. One of those fields must be specified to enable local
  # mode for the action.
  #
  # The selected container of the target Kubernetes resource will be replaced by a proxy container which runs an SSH
  # server to proxy requests.
  # Reverse port-forwarding will be automatically configured to route traffic to the locally run application and back.
  #
  # Local mode is enabled by setting the `--local` option on the `garden deploy` command.
  # Local mode always takes the precedence over sync mode if there are any conflicting service names.
  #
  # Health checks are disabled for services running in local mode.
  #
  # See the [Local Mode guide](https://docs.garden.io/guides/running-service-in-local-mode) for more information.
  #
  # Note! This feature is still experimental. Some incompatible changes can be made until the first non-experimental
  # release.
  localMode:
    # The reverse port-forwards configuration for the local application.
    ports:
      - # The local port to be used for reverse port-forward.
        local:

        # The remote port to be used for reverse port-forward.
        remote:

    # The command to run the local application. If not present, then the local application should be started manually.
    command:

    # Specifies restarting policy for the local application. By default, the local application will be restarting
    # infinitely with 1000ms between attempts.
    restart:
      # Delay in milliseconds between the local application restart attempts. The default value is 1000ms.
      delayMsec: 1000

      # Max number of the local application restarts. Unlimited by default.
      max: .inf

    # The remote Kubernetes resource to proxy traffic from. If specified, this is used instead of `defaultTarget`.
    target:
      # The kind of Kubernetes resource to find.
      kind:

      # The name of the resource, of the specified `kind`. If specified, you must also specify `kind`.
      name:

      # A map of string key/value labels to match on any Pods in the namespace. When specified, a random ready Pod
      # with matching labels will be picked as a target, so make sure the labels will always match a specific Pod
      # type.
      podSelector:

      # The name of a container in the target. Specify this if the target contains more than one container and the
      # main container is not the first container in the spec.
      containerName:
```

## Configuration Keys

### `type`

The type of action, e.g. `exec`, `container` or `kubernetes`. Some are built into Garden but mostly these will be defined by your configured providers.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

### `name`

A valid name for the action. Must be unique across all actions of the same _kind_ in your project.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

### `description`

A description of the action.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `source`

By default, the directory where the action is defined is used as the source for the build context.

You can override this by setting either `source.path` to another (POSIX-style) path relative to the action source directory, or `source.repository` to get the source from an external repository.

If using `source.path`, you must make sure the target path is in a git repository.

For `source.repository` behavior, please refer to the [Remote Sources guide](https://docs.garden.io/advanced/using-remote-sources).

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `source.path`

[source](#source) > path

A relative POSIX-style path to the source directory for this action. You must make sure this path exists and is in a git repository!

| Type        | Required |
| ----------- | -------- |
| `posixPath` | No       |

### `source.repository`

[source](#source) > repository

When set, Garden will import the action source from this repository, but use this action configuration (and not scan for configs in the separate repository).

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `source.repository.url`

[source](#source) > [repository](#sourcerepository) > url

A remote repository URL. Currently only supports git servers. Must contain a hash suffix pointing to a specific branch or tag, with the format: <git remote url>#<branch|tag>

| Type               | Required |
| ------------------ | -------- |
| `gitUrl \| string` | Yes      |

Example:

```yaml
source:
  ...
  repository:
    ...
    url: "git+https://github.com/org/repo.git#v2.0"
```

### `dependencies[]`

A list of other actions that this action depends on, and should be built, deployed or run (depending on the action type) before processing this action.

Each dependency should generally be expressed as a `"<kind>.<name>"` string, where _<kind>_ is one of `build`, `deploy`, `run` or `test`, and _<name>_ is the name of the action to depend on.

You may also optionally specify a dependency as an object, e.g. `{ kind: "Build", name: "some-image" }`.

Any empty values (i.e. null or empty strings) are ignored, so that you can conditionally add in a dependency via template expressions.

| Type                     | Default | Required |
| ------------------------ | ------- | -------- |
| `array[actionReference]` | `[]`    | No       |

Example:

```yaml
dependencies:
  - build.my-image
  - deploy.api
```

### `disabled`

Set this to `true` to disable the action. You can use this with conditional template strings to disable actions based on, for example, the current environment or other variables (e.g. `disabled: ${environment.name == "prod"}`). This can be handy when you only need certain actions for specific environments, e.g. only for development.

For Build actions, this means the build is not performed _unless_ it is declared as a dependency by another enabled action (in which case the Build is assumed to be necessary for the dependant action to be run or built).

For other action kinds, the action is skipped in all scenarios, and dependency declarations to it are ignored. Note however that template strings referencing outputs (i.e. runtime outputs) will fail to resolve when the action is disabled, so you need to make sure to provide alternate values for those if you're using them, using conditional expressions.

| Type      | Default | Required |
| --------- | ------- | -------- |
| `boolean` | `false` | No       |

### `include[]`

Specify a list of POSIX-style paths or globs that should be regarded as source files for this action, and thus will affect the computed _version_ of the action.

For actions other than _Build_ actions, this is usually not necessary to specify, or is implicitly inferred. An exception would be e.g. an `exec` action without a `build` reference, where the relevant files cannot be inferred and you want to define which files should affect the version of the action, e.g. to make sure a Test action is run when certain files are modified.

_Build_ actions have a different behavior, since they generally are based on some files in the source tree, so please reference the docs for more information on those.

Note that you can also _exclude_ files using the `exclude` field or by placing `.gardenignore` files in your source tree, which use the same format as `.gitignore` files. See the [Configuration Files guide](https://docs.garden.io/using-garden/configuration-overview#including-excluding-files-and-directories) for details.

| Type               | Required |
| ------------------ | -------- |
| `array[posixPath]` | No       |

Example:

```yaml
include:
  - my-app.js
  - some-assets/**/*
```

### `exclude[]`

Specify a list of POSIX-style paths or glob patterns that should be explicitly excluded from the action's version.

For actions other than _Build_ actions, this is usually not necessary to specify, or is implicitly inferred. For _Deploy_, _Run_ and _Test_ actions, the exclusions specified here only applied on top of explicitly set `include` paths, or such paths inferred by providers. See the [Configuration Files guide](https://docs.garden.io/using-garden/configuration-overview#including-excluding-files-and-directories) for details.

Unlike the `scan.exclude` field in the project config, the filters here have _no effect_ on which files and directories are watched for changes when watching is enabled. Use the project `scan.exclude` field to affect those, if you have large directories that should not be watched for changes.

| Type               | Required |
| ------------------ | -------- |
| `array[posixPath]` | No       |

Example:

```yaml
exclude:
  - tmp/**/*
  - '*.log'
```

### `variables`

A map of variables scoped to this particular action. These are resolved before any other parts of the action configuration and take precedence over group-scoped variables (if applicable) and project-scoped variables, in that order. They may reference group-scoped and project-scoped variables, and generally can use any template strings normally allowed when resolving the action.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `varfiles[]`

Specify a list of paths (relative to the directory where the action is defined) to a file containing variables, that we apply on top of the action-level `variables` field, and take precedence over group-level variables (if applicable) and project-level variables, in that order.

If you specify multiple paths, they are merged in the order specified, i.e. the last one takes precedence over the previous ones.

The format of the files is determined by the configured file's extension:

* `.env` - Standard "dotenv" format, as defined by [dotenv](https://github.com/motdotla/dotenv#rules).
* `.yaml`/`.yml` - YAML. The file must consist of a YAML document, which must be a map (dictionary). Keys may contain any value type.
* `.json` - JSON. Must contain a single JSON _object_ (not an array).

_NOTE: The default varfile format will change to YAML in Garden v0.13, since YAML allows for definition of nested objects and arrays._

To use different varfiles in different environments, you can template in the environment name to the varfile name, e.g. `varfile: "my-action.\$\{environment.name\}.env` (this assumes that the corresponding varfiles exist).

If a listed varfile cannot be found, it is ignored.

| Type               | Default | Required |
| ------------------ | ------- | -------- |
| `array[posixPath]` | `[]`    | No       |

Example:

```yaml
varfiles:
  "my-action.env"
```

### `build`

Specify a _Build_ action, and resolve this action from the context of that Build.

For example, you might create an `exec` Build which prepares some manifests, and then reference that in a `kubernetes` _Deploy_ action, and the resulting manifests from the Build.

This would mean that instead of looking for manifest files relative to this action's location in your project structure, the output directory for the referenced `exec` Build would be the source.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `kind`

| Type     | Allowed Values | Required |
| -------- | -------------- | -------- |
| `string` | "Deploy"       | Yes      |

### `timeout`

Timeout for the deploy to complete, in seconds.

| Type     | Default | Required |
| -------- | ------- | -------- |
| `number` | `300`   | No       |

### `spec`

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.files[]`

[spec](#spec) > files

POSIX-style paths to YAML files to load manifests from. Each can contain multiple manifests, and can include any Garden template strings, which will be resolved before applying the manifests.

| Type               | Default | Required |
| ------------------ | ------- | -------- |
| `array[posixPath]` | `[]`    | No       |

### `spec.kustomize`

[spec](#spec) > kustomize

Resolve the specified kustomization and include the resulting resources. Note that if you specify `files` or `manifests` as well, these are also included.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.kustomize.path`

[spec](#spec) > [kustomize](#speckustomize) > path

The directory path where the desired kustomization.yaml is, or a git repository URL. This could be the path to an overlay directory, for example. If it's a path, must be a relative POSIX-style path and must be within the action root. Defaults to the action root. If you set this to null, kustomize will not be run.

| Type                  | Default | Required |
| --------------------- | ------- | -------- |
| `posixPath \| string` | `"."`   | No       |

### `spec.kustomize.extraArgs[]`

[spec](#spec) > [kustomize](#speckustomize) > extraArgs

A list of additional arguments to pass to the `kustomize build` command. Note that specifying '-o' or '--output' is not allowed.

| Type            | Default | Required |
| --------------- | ------- | -------- |
| `array[string]` | `[]`    | No       |

### `spec.manifests[]`

[spec](#spec) > manifests

List of Kubernetes resource manifests to deploy. If `files` is also specified, this is combined with the manifests read from the files.

| Type            | Default | Required |
| --------------- | ------- | -------- |
| `array[object]` | `[]`    | No       |

### `spec.manifests[].apiVersion`

[spec](#spec) > [manifests](#specmanifests) > apiVersion

The API version of the resource.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

### `spec.manifests[].kind`

[spec](#spec) > [manifests](#specmanifests) > kind

The kind of the resource.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

### `spec.manifests[].metadata`

[spec](#spec) > [manifests](#specmanifests) > metadata

| Type     | Required |
| -------- | -------- |
| `object` | Yes      |

### `spec.manifests[].metadata.name`

[spec](#spec) > [manifests](#specmanifests) > [metadata](#specmanifestsmetadata) > name

The name of the resource.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

### `spec.namespace`

[spec](#spec) > namespace

A valid Kubernetes namespace name. Must be a valid RFC1035/RFC1123 (DNS) label (may contain lowercase letters, numbers and dashes, must start with a letter, and cannot end with a dash) and must not be longer than 63 characters.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.portForwards[]`

[spec](#spec) > portForwards

Manually specify port forwards that Garden should set up when deploying in dev or watch mode. If specified, these override the auto-detection of forwardable ports, so you'll need to specify the full list of port forwards to create.

| Type            | Required |
| --------------- | -------- |
| `array[object]` | No       |

### `spec.portForwards[].name`

[spec](#spec) > [portForwards](#specportforwards) > name

An identifier to describe the port forward.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.portForwards[].resource`

[spec](#spec) > [portForwards](#specportforwards) > resource

The full resource kind and name to forward to, e.g. Service/my-service or Deployment/my-deployment. Note that Garden will not validate this ahead of attempting to start the port forward, so you need to make sure this is correctly set. The types of resources supported will match that of the `kubectl port-forward` CLI command.

| Type     | Required |
| -------- | -------- |
| `string` | Yes      |

### `spec.portForwards[].targetPort`

[spec](#spec) > [portForwards](#specportforwards) > targetPort

The port number on the remote resource to forward to.

| Type     | Required |
| -------- | -------- |
| `number` | Yes      |

### `spec.portForwards[].localPort`

[spec](#spec) > [portForwards](#specportforwards) > localPort

The _preferred_ local port to forward from. If none is set, a random port is chosen. If the specified port is not available, a warning is shown and a random port chosen instead.

| Type     | Required |
| -------- | -------- |
| `number` | No       |

### `spec.timeout`

[spec](#spec) > timeout

The maximum duration (in seconds) to wait for resources to deploy and become healthy.

| Type     | Default | Required |
| -------- | ------- | -------- |
| `number` | `300`   | No       |

### `spec.waitForJobs`

[spec](#spec) > waitForJobs

Wait until the jobs have been completed. Garden will wait for as long as `timeout`.

| Type      | Default | Required |
| --------- | ------- | -------- |
| `boolean` | `false` | No       |

### `spec.defaultTarget`

[spec](#spec) > defaultTarget

Specify a default resource in the deployment to use for syncs, local mode, and for the `garden exec` command.

Specify either `kind` and `name`, or a `podSelector`. The resource should be one of the resources deployed by this action (otherwise the target is not guaranteed to be deployed with adjustments required for syncing or local mode).

Set `containerName` to specify a container to connect to in the remote Pod. By default the first container in the Pod is used.

Note that if you specify `podSelector` here, it is not validated to be a selector matching one of the resources deployed by the action.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.defaultTarget.kind`

[spec](#spec) > [defaultTarget](#specdefaulttarget) > kind

The kind of Kubernetes resource to find.

| Type     | Allowed Values                           | Required |
| -------- | ---------------------------------------- | -------- |
| `string` | "Deployment", "DaemonSet", "StatefulSet" | Yes      |

### `spec.defaultTarget.name`

[spec](#spec) > [defaultTarget](#specdefaulttarget) > name

The name of the resource, of the specified `kind`. If specified, you must also specify `kind`.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.defaultTarget.podSelector`

[spec](#spec) > [defaultTarget](#specdefaulttarget) > podSelector

A map of string key/value labels to match on any Pods in the namespace. When specified, a random ready Pod with matching labels will be picked as a target, so make sure the labels will always match a specific Pod type.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.defaultTarget.containerName`

[spec](#spec) > [defaultTarget](#specdefaulttarget) > containerName

The name of a container in the target. Specify this if the target contains more than one container and the main container is not the first container in the spec.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.sync`

[spec](#spec) > sync

Configure path syncs for the resources in this Deploy.

If you have multiple syncs for the Deploy, you can use the `defaults` field to set common configuration for every individual sync.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.sync.defaults`

[spec](#spec) > [sync](#specsync) > defaults

Defaults to set across every sync for this Deploy. If you use the `exclude` field here, it will be merged with any excludes set in individual syncs. These are applied on top of any defaults set in the provider configuration.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.sync.defaults.exclude[]`

[spec](#spec) > [sync](#specsync) > [defaults](#specsyncdefaults) > exclude

Specify a list of POSIX-style paths or glob patterns that should be excluded from the sync.

Any exclusion patterns defined in individual sync specs will be applied in addition to these patterns.

`.git` directories and `.garden` directories are always ignored.

| Type               | Required |
| ------------------ | -------- |
| `array[posixPath]` | No       |

Example:

```yaml
spec:
  ...
  sync:
    ...
    defaults:
      ...
      exclude:
        - dist/**/*
        - '*.log'
```

### `spec.sync.defaults.fileMode`

[spec](#spec) > [sync](#specsync) > [defaults](#specsyncdefaults) > fileMode

The default permission bits, specified as an octal, to set on files at the sync target. Defaults to 0o644 (user can read/write, everyone else can read). See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#permissions) for more information.

| Type     | Default | Required |
| -------- | ------- | -------- |
| `number` | `0o644` | No       |

### `spec.sync.defaults.directoryMode`

[spec](#spec) > [sync](#specsync) > [defaults](#specsyncdefaults) > directoryMode

The default permission bits, specified as an octal, to set on directories at the sync target. Defaults to 0o755 (user can read/write, everyone else can read). See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#permissions) for more information.

| Type     | Default | Required |
| -------- | ------- | -------- |
| `number` | `0o755` | No       |

### `spec.sync.defaults.owner`

[spec](#spec) > [sync](#specsync) > [defaults](#specsyncdefaults) > owner

Set the default owner of files and directories at the target. Specify either an integer ID or a string name. See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#owners-and-groups) for more information.

| Type               | Required |
| ------------------ | -------- |
| `number \| string` | No       |

### `spec.sync.defaults.group`

[spec](#spec) > [sync](#specsync) > [defaults](#specsyncdefaults) > group

Set the default group on files and directories at the target. Specify either an integer ID or a string name. See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#owners-and-groups) for more information.

| Type               | Required |
| ------------------ | -------- |
| `number \| string` | No       |

### `spec.sync.paths[]`

[spec](#spec) > [sync](#specsync) > paths

A list of syncs to start once the Deploy is successfully started.

| Type            | Required |
| --------------- | -------- |
| `array[object]` | No       |

### `spec.sync.paths[].target`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > target

The Kubernetes resource to sync to. If specified, this is used instead of `spec.defaultTarget`.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.sync.paths[].target.kind`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > [target](#specsyncpathstarget) > kind

The kind of Kubernetes resource to find.

| Type     | Allowed Values                           | Required |
| -------- | ---------------------------------------- | -------- |
| `string` | "Deployment", "DaemonSet", "StatefulSet" | Yes      |

### `spec.sync.paths[].target.name`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > [target](#specsyncpathstarget) > name

The name of the resource, of the specified `kind`. If specified, you must also specify `kind`.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.sync.paths[].target.podSelector`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > [target](#specsyncpathstarget) > podSelector

A map of string key/value labels to match on any Pods in the namespace. When specified, a random ready Pod with matching labels will be picked as a target, so make sure the labels will always match a specific Pod type.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.sync.paths[].target.containerName`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > [target](#specsyncpathstarget) > containerName

The name of a container in the target. Specify this if the target contains more than one container and the main container is not the first container in the spec.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.sync.paths[].sourcePath`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > sourcePath

The local path to sync from, either absolute or relative to the source directory where the Deploy action is defined.

This should generally be a templated path to another action's source path (e.g. `${actions.build.my-container-image.sourcePath}`), or a relative path. If a path is hard-coded, you must make sure the path exists, and that it is reliably the correct path for every user.

| Type        | Default | Required |
| ----------- | ------- | -------- |
| `posixPath` | `"."`   | No       |

### `spec.sync.paths[].containerPath`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > containerPath

POSIX-style absolute path to sync to inside the container. The root path (i.e. "/") is not allowed.

| Type        | Required |
| ----------- | -------- |
| `posixPath` | Yes      |

Example:

```yaml
spec:
  ...
  sync:
    ...
    paths:
      - containerPath: "/app/src"
```

### `spec.sync.paths[].exclude[]`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > exclude

Specify a list of POSIX-style paths or glob patterns that should be excluded from the sync.

`.git` directories and `.garden` directories are always ignored.

| Type               | Required |
| ------------------ | -------- |
| `array[posixPath]` | No       |

Example:

```yaml
spec:
  ...
  sync:
    ...
    paths:
      - exclude:
          - dist/**/*
          - '*.log'
```

### `spec.sync.paths[].mode`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > mode

The sync mode to use for the given paths. See the [Code Synchronization guide](https://docs.garden.io/guides/code-synchronization) for details.

| Type     | Allowed Values                                                                                                                            | Default          | Required |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------- |
| `string` | "one-way", "one-way-safe", "one-way-replica", "one-way-reverse", "one-way-replica-reverse", "two-way", "two-way-safe", "two-way-resolved" | `"one-way-safe"` | Yes      |

### `spec.sync.paths[].defaultFileMode`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > defaultFileMode

The default permission bits, specified as an octal, to set on files at the sync target. Defaults to 0o644 (user can read/write, everyone else can read). See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#permissions) for more information.

| Type     | Default | Required |
| -------- | ------- | -------- |
| `number` | `0o644` | No       |

### `spec.sync.paths[].defaultDirectoryMode`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > defaultDirectoryMode

The default permission bits, specified as an octal, to set on directories at the sync target. Defaults to 0o755 (user can read/write, everyone else can read). See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#permissions) for more information.

| Type     | Default | Required |
| -------- | ------- | -------- |
| `number` | `0o755` | No       |

### `spec.sync.paths[].defaultOwner`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > defaultOwner

Set the default owner of files and directories at the target. Specify either an integer ID or a string name. See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#owners-and-groups) for more information.

| Type               | Required |
| ------------------ | -------- |
| `number \| string` | No       |

### `spec.sync.paths[].defaultGroup`

[spec](#spec) > [sync](#specsync) > [paths](#specsyncpaths) > defaultGroup

Set the default group on files and directories at the target. Specify either an integer ID or a string name. See the [Mutagen docs](https://mutagen.io/documentation/synchronization/permissions#owners-and-groups) for more information.

| Type               | Required |
| ------------------ | -------- |
| `number \| string` | No       |

### `spec.sync.overrides[]`

[spec](#spec) > [sync](#specsync) > overrides

Overrides for the container command and/or arguments for when in sync mode.

| Type            | Required |
| --------------- | -------- |
| `array[object]` | No       |

### `spec.sync.overrides[].target`

[spec](#spec) > [sync](#specsync) > [overrides](#specsyncoverrides) > target

The Kubernetes resources to override. If specified, this is used instead of `spec.defaultTarget`.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.sync.overrides[].target.kind`

[spec](#spec) > [sync](#specsync) > [overrides](#specsyncoverrides) > [target](#specsyncoverridestarget) > kind

The kind of Kubernetes resource to find.

| Type     | Allowed Values                           | Required |
| -------- | ---------------------------------------- | -------- |
| `string` | "Deployment", "DaemonSet", "StatefulSet" | Yes      |

### `spec.sync.overrides[].target.name`

[spec](#spec) > [sync](#specsync) > [overrides](#specsyncoverrides) > [target](#specsyncoverridestarget) > name

The name of the resource, of the specified `kind`. If specified, you must also specify `kind`.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.sync.overrides[].target.podSelector`

[spec](#spec) > [sync](#specsync) > [overrides](#specsyncoverrides) > [target](#specsyncoverridestarget) > podSelector

A map of string key/value labels to match on any Pods in the namespace. When specified, a random ready Pod with matching labels will be picked as a target, so make sure the labels will always match a specific Pod type.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.sync.overrides[].target.containerName`

[spec](#spec) > [sync](#specsync) > [overrides](#specsyncoverrides) > [target](#specsyncoverridestarget) > containerName

The name of a container in the target. Specify this if the target contains more than one container and the main container is not the first container in the spec.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.sync.overrides[].command[]`

[spec](#spec) > [sync](#specsync) > [overrides](#specsyncoverrides) > command

Override the command/entrypoint in the matched container.

| Type            | Required |
| --------------- | -------- |
| `array[string]` | No       |

### `spec.sync.overrides[].args[]`

[spec](#spec) > [sync](#specsync) > [overrides](#specsyncoverrides) > args

Override the args in the matched container.

| Type            | Required |
| --------------- | -------- |
| `array[string]` | No       |

### `spec.localMode`

[spec](#spec) > localMode

[EXPERIMENTAL] Configures the local application which will send and receive network requests instead of the target resource specified by `localMode.target` or `defaultTarget`. One of those fields must be specified to enable local mode for the action.

The selected container of the target Kubernetes resource will be replaced by a proxy container which runs an SSH server to proxy requests.
Reverse port-forwarding will be automatically configured to route traffic to the locally run application and back.

Local mode is enabled by setting the `--local` option on the `garden deploy` command.
Local mode always takes the precedence over sync mode if there are any conflicting service names.

Health checks are disabled for services running in local mode.

See the [Local Mode guide](https://docs.garden.io/guides/running-service-in-local-mode) for more information.

Note! This feature is still experimental. Some incompatible changes can be made until the first non-experimental release.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.localMode.ports[]`

[spec](#spec) > [localMode](#speclocalmode) > ports

The reverse port-forwards configuration for the local application.

| Type            | Required |
| --------------- | -------- |
| `array[object]` | No       |

### `spec.localMode.ports[].local`

[spec](#spec) > [localMode](#speclocalmode) > [ports](#speclocalmodeports) > local

The local port to be used for reverse port-forward.

| Type     | Required |
| -------- | -------- |
| `number` | No       |

### `spec.localMode.ports[].remote`

[spec](#spec) > [localMode](#speclocalmode) > [ports](#speclocalmodeports) > remote

The remote port to be used for reverse port-forward.

| Type     | Required |
| -------- | -------- |
| `number` | No       |

### `spec.localMode.command[]`

[spec](#spec) > [localMode](#speclocalmode) > command

The command to run the local application. If not present, then the local application should be started manually.

| Type            | Required |
| --------------- | -------- |
| `array[string]` | No       |

### `spec.localMode.restart`

[spec](#spec) > [localMode](#speclocalmode) > restart

Specifies restarting policy for the local application. By default, the local application will be restarting infinitely with 1000ms between attempts.

| Type     | Default                         | Required |
| -------- | ------------------------------- | -------- |
| `object` | `{"delayMsec":1000,"max":null}` | No       |

### `spec.localMode.restart.delayMsec`

[spec](#spec) > [localMode](#speclocalmode) > [restart](#speclocalmoderestart) > delayMsec

Delay in milliseconds between the local application restart attempts. The default value is 1000ms.

| Type     | Default | Required |
| -------- | ------- | -------- |
| `number` | `1000`  | No       |

### `spec.localMode.restart.max`

[spec](#spec) > [localMode](#speclocalmode) > [restart](#speclocalmoderestart) > max

Max number of the local application restarts. Unlimited by default.

| Type     | Default | Required |
| -------- | ------- | -------- |
| `number` | `null`  | No       |

### `spec.localMode.target`

[spec](#spec) > [localMode](#speclocalmode) > target

The remote Kubernetes resource to proxy traffic from. If specified, this is used instead of `defaultTarget`.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.localMode.target.kind`

[spec](#spec) > [localMode](#speclocalmode) > [target](#speclocalmodetarget) > kind

The kind of Kubernetes resource to find.

| Type     | Allowed Values                           | Required |
| -------- | ---------------------------------------- | -------- |
| `string` | "Deployment", "DaemonSet", "StatefulSet" | Yes      |

### `spec.localMode.target.name`

[spec](#spec) > [localMode](#speclocalmode) > [target](#speclocalmodetarget) > name

The name of the resource, of the specified `kind`. If specified, you must also specify `kind`.

| Type     | Required |
| -------- | -------- |
| `string` | No       |

### `spec.localMode.target.podSelector`

[spec](#spec) > [localMode](#speclocalmode) > [target](#speclocalmodetarget) > podSelector

A map of string key/value labels to match on any Pods in the namespace. When specified, a random ready Pod with matching labels will be picked as a target, so make sure the labels will always match a specific Pod type.

| Type     | Required |
| -------- | -------- |
| `object` | No       |

### `spec.localMode.target.containerName`

[spec](#spec) > [localMode](#speclocalmode) > [target](#speclocalmodetarget) > containerName

The name of a container in the target. Specify this if the target contains more than one container and the main container is not the first container in the spec.

| Type     | Required |
| -------- | -------- |
| `string` | No       |


## Outputs

The following keys are available via the `${actions.deploy.<name>}` template string key for `kubernetes`
action.

### `${actions.deploy.<name>.name}`

The name of the action.

| Type     |
| -------- |
| `string` |

### `${actions.deploy.<name>.disabled}`

Whether the action is disabled.

| Type      |
| --------- |
| `boolean` |

Example:

```yaml
my-variable: ${actions.deploy.my-deploy.disabled}
```

### `${actions.deploy.<name>.buildPath}`

The local path to the action build directory.

| Type     |
| -------- |
| `string` |

Example:

```yaml
my-variable: ${actions.deploy.my-deploy.buildPath}
```

### `${actions.deploy.<name>.sourcePath}`

The local path to the action source directory.

| Type     |
| -------- |
| `string` |

Example:

```yaml
my-variable: ${actions.deploy.my-deploy.sourcePath}
```

### `${actions.deploy.<name>.mode}`

The mode that the action should be executed in (e.g. 'sync' or 'local' for Deploy actions). Set to 'default' if no special mode is being used.

| Type     | Default     |
| -------- | ----------- |
| `string` | `"default"` |

Example:

```yaml
my-variable: ${actions.deploy.my-deploy.mode}
```

### `${actions.deploy.<name>.var.*}`

The variables configured on the action.

| Type     | Default |
| -------- | ------- |
| `object` | `{}`    |

### `${actions.deploy.<name>.var.<name>}`

| Type                                                 |
| ---------------------------------------------------- |
| `string \| number \| boolean \| link \| array[link]` |
