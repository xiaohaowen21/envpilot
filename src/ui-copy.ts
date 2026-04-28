import type {
  DashboardData,
  JavaVendor,
  PathIssueType,
  SystemToolSummary,
} from '../shared/contracts'

export type Locale = 'zh-CN' | 'en-US'
export type WorkspaceId = 'overview' | 'software' | 'versions' | 'platform' | 'variables' | 'settings'
export type SidebarGroupId = 'core' | 'governance'

export interface WorkspaceCardCopy {
  description: string
  group: SidebarGroupId
  id: WorkspaceId
  metric: string
  title: string
}

export const javaVendorLabel: Record<JavaVendor, { 'zh-CN': string; 'en-US': string }> = {
  microsoft: {
    'en-US': 'Microsoft',
    'zh-CN': '微软',
  },
  oracle: {
    'en-US': 'Oracle',
    'zh-CN': '甲骨文',
  },
  temurin: {
    'en-US': 'Temurin',
    'zh-CN': 'Temurin',
  },
}

export const uiCopy = {
  'zh-CN': {
    autoCleanup: '一键整理变量',
    autoCleanupWorking: '整理中…',
    backupCountMetric: (count: number) => `${count} 份备份`,
    backupNow: '立即备份',
    backupWorking: '备份中…',
    close: '取消',
    commandLabel: '命令',
    confirmAgain: '请再次确认',
    currentWorkspace: '当前工作区',
    issueTypeMap: {
      duplicate: '重复项',
      empty: '空项',
      missing: '失效路径',
      quoted: '带引号路径',
    } satisfies Record<PathIssueType, string>,
    language: { en: 'English', label: '语言', zh: '中文' },
    loadingCopy: '首次启动会扫描系统软件、命令行运行时、环境变量与虚拟化能力。',
    loadingTitle: 'EnvPilot 正在分析这台 Windows 机器…',
    localeBadge: 'Windows MVP',
    networkAccessible: '可访问',
    networkRestricted: '受限',
    noneDetected: '未检测到',
    notFoundInPath: '当前 PATH 中没有发现对应命令',
    operationHint: '真正执行关闭、卸载或覆盖切换前，都会要求再确认一次。',
    overview: {
      adminHelp: '系统级修改、虚拟化功能启停和 Docker 安装通常需要管理员权限。',
      adminMissing: '未具备',
      adminReady: '已具备',
      architecture: '系统架构',
      backupAndDirectory: '备份与目录',
      backupDirectory: '备份目录',
      environmentCount: '环境变量总数',
      generatedAt: (value: string) => `生成于 ${value}`,
      network: '网络状态',
      networkHelp: '下载安装包、获取目录与镜像需要网络连接。',
      operatingSystem: '操作系统',
      permission: '管理员权限',
      recentBackups: '历史备份数量',
      recentLogs: '最近操作日志',
      recentLogsNote: '自动记录安装、切换、卸载、清理与回滚。',
      rootDirectory: '主工作目录',
      storageHint: '默认使用 D 盘',
      systemBaseline: '系统基线',
      thereAreNoLogs: '当前还没有操作日志。',
    },
    platform: {
      currentState: '当前状态',
      desktopSoftware: '桌面软件',
      dockerDescription: '安装或移除 Docker Desktop，并与 Windows 功能开关严格区分。',
      dockerInstalled: '已安装',
      dockerNotInstalled: '未安装',
      dockerUninstall: '卸载 Docker Desktop',
      dockerVersionUnknown: '尚未返回 Docker 版本信息',
      enableFeature: '启用功能',
      featureVersionUnknown: 'Windows 功能本身不提供独立版本号',
      heroDescription: '把 Windows 功能 与 独立桌面软件 分开管理，减少"关闭"和"卸载"混淆。',
      hypervDescription: '管理 Hyper-V，适合虚拟机、隔离环境与企业级开发场景。',
      infoTitle: '平台能力管理',
      processing: '处理中…',
      statusEnabled: '已启用',
      statusNotEnabled: '未启用',
      statusPending: '等待重启',
      systemFeature: '系统功能',
      turnOffFeature: '关闭功能',
      turnOffFeatureNote: '关闭系统功能后，通常需要重启系统才能完全生效。',
      vmpDescription: '管理 Virtual Machine Platform，WSL2 与 Docker Desktop 常依赖它。',
      wslDescription: '管理 Windows Subsystem for Linux，并识别已安装但未启动的 WSL。',
      wslInstalledRunning: '已安装，且至少有一个发行版正在运行。',
      wslInstalledStopped: '已安装，但当前发行版未启动。',
      wslMissing: '未检测到可用的 WSL 安装。',
    },
    previewCleanup: '预览清理',
    previewWorking: '分析中…',
    shared: {
      activeVersion: '当前生效',
      entryPoint: '统一入口',
      managedDirectory: '托管目录',
      officialCatalog: '官方目录',
      programSource: 'Windows 注册表',
      realDirectory: '真实安装目录',
      sourcePath: 'PATH 检测',
      unknownVersion: '未知版本',
    },
    sidebar: {
      appSubtitle: '开发环境部署、版本切换、变量治理',
      coreGroup: '核心工作区',
      governanceGroup: '治理与修复',
    },
    software: {
      commandDetected: '命令检测',
      heroDescription: '盘点机器里已经存在的开发工具，无论是不是由 EnvPilot 安装，都明确展示。',
      registryCount: (count: number) => `注册表记录 ${count}`,
      registryEmpty: '没有识别到这类软件的系统安装记录。',
      registrySection: '系统安装记录',
      searchPlaceholder: '搜索软件名称、运行时或发布者…',
      uninstallSoftware: '卸载软件',
    },
    variables: {
      autoCleanup: '一键自动整理',
      backupBaseline: '环境备份基线',
      backupBaselineNote: '任何重要修改前都应先保留一份可回滚快照。',
      backupMissing: '还没有备份记录，建议先创建一份。',
      cleanupPreview: '自动整理预览',
      cleanupPreviewNote: '先预览，再一键执行。',
      heroDescription: '扫描 PATH 风险、清理冗余条目，并保留环境变量回滚点。',
      noCleanupPreview: '先点击"重新生成预览"，再决定是否执行自动整理。',
      noIssues: '暂未发现明显问题',
      pathEntry: 'PATH 项',
      pathIssue: '问题类型',
      pathScan: 'PATH 风险扫描',
      pendingCount: (count: number) => `${count} 项待处理`,
      rebuildPreview: '重新生成预览',
      removableSuggestion: '建议删除',
      suggestedFixes: '建议修复',
      scope: '范围',
    },
    versions: {
      autoManagedLabel: '自动化安装与切换',
      autoManagedRuntimeFlow:
        '这里的"安装"会自动下载官方包、解压到 D 盘、写入环境变量，并建立统一入口，无需手动找目录。',
      autoManagedRuntimeNote:
        'Java 会自动维护 JAVA_HOME；Go、Node.js、Python、PHP、Rust 会自动处理 PATH 或相关变量。',
      cleanupArchive: '安装成功后清理缓存压缩包',
      cleanupArchiveHint: '默认开启，避免 D:\\EnvPilot\\downloads 留下过多 zip / exe 缓存。',
      detectedInstalls: '系统已识别安装',
      environmentBindings: '环境变量与入口',
      environmentBindingsBadge: (count: number) => `${count} 项绑定`,
      environmentBindingsNotActive: '未激活',
      install: '安装',
      installing: '安装中…',
      managedCount: (count: number) => `${count} 个托管版本`,
      managedEmpty: '当前还没有由 EnvPilot 管理的版本。',
      managedVersions: 'EnvPilot 托管版本',
      noActiveVersionTip: '当前还没有激活版本，所以还不会写入该语言的入口和环境变量。',
      noSystemRecord: '没有发现系统安装记录，但仍可能通过命令行可用。',
      selectedVendor: 'Java 发行方',
      sharedEntryPointHint: '当前激活版本会被统一映射到这个固定入口。',
      sharedEntryPointTitle: '统一入口目录',
      switch: '切换',
      switchableVersion: '可切换版本',
      switching: '切换中…',
      uninstallVersion: '卸载版本',
      uninstalling: '卸载中…',
      vendorHint: '你可以按发行方安装 Java，同一大版本可并存。',
      versionCatalog: '可安装版本目录',
      workflowStep1Title: '官方包获取',
      workflowStep1Description: '统一从官方源下载，可复用缓存，并把下载与安装状态拆开显示。',
      workflowStep2Title: '托管安装目录',
      workflowStep2Description: '运行时会落到 D 盘托管目录，并通过稳定入口做版本切换。',
      workflowStep3Title: '环境变量生效',
      workflowStep3Description: '安装完成后会同步入口、PATH 以及对应语言变量，并立即刷新当前进程。',
    },
    workspace: {
      overview: { description: '查看系统基线、目录、备份与最近日志', title: '总览' },
      platform: { description: '管理 WSL、Hyper-V、虚拟化平台与 Docker', title: '虚拟化与 Docker' },
      settings: { description: '配置存储路径、代理、主题等应用设置', title: '应用设置' },
      software: { description: '识别机器里已有的软件并提供卸载入口', title: '系统安装管理' },
      variables: { description: '扫描、修复并回滚环境变量与 PATH 风险', title: '变量治理' },
      versions: { description: '安装、切换并托管多版本运行时', title: '多版本运行时' },
    },

    // --- Previously inline i18n entries (moved from App.tsx ternaries) ---

    progress: {
      workingTitle: '正在处理当前任务',
      workingDetail: '正在刷新下载、安装或环境变量步骤。',
      processing: '处理中',
    },

    confirm: {
      actionType: '操作类型',
      target: '目标对象',
      uninstallProgram: {
        actionLabel: '卸载软件',
        confirmLabel: '确认卸载',
        description: '这会调用 Windows 中登记的原始卸载程序，并按该软件自己的卸载流程执行。',
        title: '确认卸载软件',
      },
      uninstallRuntime: {
        actionLabel: '卸载托管版本',
        confirmLabel: '确认卸载版本',
        description: '这会删除 EnvPilot 托管目录中的该版本文件，并同步清理当前版本切换记录。',
        title: '确认卸载托管版本',
      },
      uninstallDocker: {
        actionLabel: '卸载 Docker Desktop',
        confirmLabel: '确认卸载 Docker Desktop',
        description: '这会触发 Docker Desktop 自身的卸载流程，Windows 功能开关不会被一并移除。',
        title: '确认卸载 Docker Desktop',
      },
      disableFeature: {
        actionLabel: '关闭系统功能',
        confirmLabel: '确认关闭功能',
        description: '这会关闭对应的 Windows 功能。执行后可能需要重启系统。',
        title: '确认关闭系统功能',
      },
    },

    settings: {
      storageTitle: '存储设置',
      workingDirectoryLabel: '工作目录',
      workingDirectoryPlaceholder: '留空使用默认路径',
      workingDirectoryHint: 'EnvPilot 将在此目录下存储运行时、下载缓存和备份文件。',
      cleanupArchiveLabel: '安装后清理下载缓存',
      cleanupArchiveHint: '避免 D:\\EnvPilot\\downloads 留下过多 zip / exe 缓存。',
      proxyTitle: '代理设置',
      proxyEnabledLabel: '启用代理',
      proxyEnabledHint: '通过代理服务器下载安装包。',
      proxyServerLabel: '代理服务器',
      usernameLabel: '用户名',
      usernamePlaceholder: '可选',
      passwordLabel: '密码',
      passwordPlaceholder: '可选',
      appearanceTitle: '外观设置',
      themeLabel: '主题',
      themeLight: '浅色',
      themeDark: '深色',
      themeSystem: '跟随系统',
      languageLabel: '语言',
      aboutTitle: '关于',
      aboutVersion: '版本',
      aboutDescription: 'Windows 环境自动化配置工具',
      configImportTitle: '配置导入/导出',
      configImportDescription: '导出当前配置到文件，或从文件导入配置。',
      exportConfig: '导出配置',
      exportingConfig: '导出中…',
      configExported: '配置已导出',
      importConfig: '导入配置',
      importingConfig: '导入中…',
      operationLogsTitle: '操作日志',
      clearLogs: '清除日志',
      clearingLogs: '清除中…',
      noLogs: '暂无操作日志',
      backupManagementTitle: '备份管理',
      noBackups: '暂无备份记录',
      restoreBackup: '恢复',
      deleteBackup: '删除',
      restoreConfirmTitle: '确认恢复备份',
      restoreConfirmLabel: '确认恢复',
      restoreConfirmDescription: '这会将环境变量恢复到该备份时的状态。',
      restoreConfirmAction: '恢复备份',
      deleteConfirmTitle: '确认删除备份',
      deleteConfirmLabel: '确认删除',
      deleteConfirmDescription: '这会永久删除该备份文件。',
      deleteConfirmAction: '删除备份',
      diagnosticsTitle: '环境诊断',
      runDiagnostics: '运行诊断',
      diagnosing: '诊断中…',
      noDiagnostics: '点击"运行诊断"检查系统环境状态',
      diagnosticCategorySystem: '系统信息',
      diagnosticCategoryStorage: '存储路径',
      diagnosticCategoryEnvironment: '环境变量',
      diagnosticCategoryRuntimes: '运行时检测',
      diagnosticCategoryNetwork: '网络连接',
      saveSettings: '保存设置',
      savingSettings: '保存中…',
    },

    platformVersion: '版本',

    // Sidebar metrics (previously inline)
    softwareCountMetric: (count: number) => `${count} 项软件记录`,
    platformActiveMetric: (count: number) => `${count} 项已启用`,
    settingsConfigMetric: '配置管理',

    // Docker install label (previously inline in getToolInstallLabel)
    installDockerDesktop: '安装 Docker Desktop',
  },
  'en-US': {
    autoCleanup: 'Run auto cleanup',
    autoCleanupWorking: 'Cleaning…',
    backupCountMetric: (count: number) => `${count} backups`,
    backupNow: 'Create backup',
    backupWorking: 'Backing up…',
    close: 'Cancel',
    commandLabel: 'Command',
    confirmAgain: 'Please confirm again',
    currentWorkspace: 'Current workspace',
    issueTypeMap: {
      duplicate: 'Duplicate',
      empty: 'Empty',
      missing: 'Missing path',
      quoted: 'Quoted path',
    } satisfies Record<PathIssueType, string>,
    language: { en: 'English', label: 'Language', zh: '中文' },
    loadingCopy: 'The first launch scans installed software, command-line runtimes, environment variables, and virtualization capabilities.',
    loadingTitle: 'EnvPilot is scanning this Windows machine…',
    localeBadge: 'Windows MVP',
    networkAccessible: 'Accessible',
    networkRestricted: 'Restricted',
    noneDetected: 'Not detected',
    notFoundInPath: 'No matching command is currently available in PATH',
    operationHint: 'Any destructive action still requires one more explicit confirmation.',
    overview: {
      adminHelp: 'System-wide changes, virtualization toggles, and Docker setup usually need administrator rights.',
      adminMissing: 'Missing',
      adminReady: 'Available',
      architecture: 'Architecture',
      backupAndDirectory: 'Backups & directories',
      backupDirectory: 'Backup directory',
      environmentCount: 'Environment variables',
      generatedAt: (value: string) => `Generated at ${value}`,
      network: 'Network',
      networkHelp: 'Downloads, catalogs, and mirrors require network access.',
      operatingSystem: 'Operating system',
      permission: 'Administrator rights',
      recentBackups: 'Backups kept',
      recentLogs: 'Recent operation log',
      recentLogsNote: 'Records installs, switches, uninstalls, cleanup actions, and rollbacks automatically.',
      rootDirectory: 'Working directory',
      storageHint: 'Defaults to drive D',
      systemBaseline: 'System baseline',
      thereAreNoLogs: 'No operation logs yet.',
    },
    platform: {
      currentState: 'Current state',
      desktopSoftware: 'Desktop software',
      dockerDescription: 'Install or remove Docker Desktop while keeping it clearly separate from Windows feature toggles.',
      dockerInstalled: 'Installed',
      dockerNotInstalled: 'Not installed',
      dockerUninstall: 'Uninstall Docker Desktop',
      dockerVersionUnknown: 'Docker version info is not available yet',
      enableFeature: 'Enable feature',
      featureVersionUnknown: 'Windows features do not expose a separate version number',
      heroDescription: 'Separates Windows features from standalone software so disable and uninstall actions stay unambiguous.',
      hypervDescription: 'Manage Hyper-V for virtual machines, isolation, and enterprise-ready workflows.',
      infoTitle: 'Platform capability management',
      processing: 'Processing…',
      statusEnabled: 'Enabled',
      statusNotEnabled: 'Disabled',
      statusPending: 'Restart required',
      systemFeature: 'System feature',
      turnOffFeature: 'Disable feature',
      turnOffFeatureNote: 'Disabling a Windows feature usually requires a reboot before it fully takes effect.',
      vmpDescription: 'Manage Virtual Machine Platform, a common dependency for WSL2 and Docker Desktop.',
      wslDescription: 'Manage Windows Subsystem for Linux and detect WSL even when distributions are installed but not started.',
      wslInstalledRunning: 'Installed, and at least one distribution is currently running.',
      wslInstalledStopped: 'Installed, but current distributions are not running.',
      wslMissing: 'No usable WSL installation was detected.',
    },
    previewCleanup: 'Preview cleanup',
    previewWorking: 'Analyzing…',
    shared: {
      activeVersion: 'Active',
      entryPoint: 'Entry point',
      managedDirectory: 'Managed directory',
      officialCatalog: 'Official catalog',
      programSource: 'Windows registry',
      realDirectory: 'Real install directory',
      sourcePath: 'PATH detection',
      unknownVersion: 'Unknown version',
    },
    sidebar: {
      appSubtitle: 'Environment setup, version switching, and variable governance',
      coreGroup: 'Core workspaces',
      governanceGroup: 'Governance',
    },
    software: {
      commandDetected: 'Command detection',
      heroDescription: 'Inventory developer tools already present on this machine, whether or not EnvPilot installed them.',
      registryCount: (count: number) => `Registry records ${count}`,
      registryEmpty: 'No matching system install record was detected.',
      registrySection: 'System install records',
      searchPlaceholder: 'Search software name, runtime, or publisher…',
      uninstallSoftware: 'Uninstall software',
    },
    variables: {
      autoCleanup: 'Run automatic cleanup',
      backupBaseline: 'Backup baseline',
      backupBaselineNote: 'Keep a rollback snapshot before important changes.',
      backupMissing: 'No backup history yet. Creating one now is recommended.',
      cleanupPreview: 'Cleanup preview',
      cleanupPreviewNote: 'Preview first, then apply in one click.',
      heroDescription: 'Scan PATH risk, remove redundant entries, and keep rollback-friendly environment backups.',
      noCleanupPreview: 'Generate a fresh preview first, then decide whether to apply the cleanup.',
      noIssues: 'No obvious issue detected',
      pathEntry: 'PATH entry',
      pathIssue: 'Issue type',
      pathScan: 'PATH risk scan',
      pendingCount: (count: number) => `${count} items pending`,
      rebuildPreview: 'Regenerate preview',
      removableSuggestion: 'Suggested removals',
      suggestedFixes: 'Suggested fixes',
      scope: 'Scope',
    },
    versions: {
      autoManagedLabel: 'Automated install and switching',
      autoManagedRuntimeFlow:
        'Install here means EnvPilot downloads the official package, extracts it to drive D, wires the environment variables, and keeps a stable entry point for you.',
      autoManagedRuntimeNote:
        'Java manages JAVA_HOME automatically. Go, Node.js, Python, PHP, and Rust also update PATH or related variables automatically.',
      cleanupArchive: 'Delete cached archive after a successful install',
      cleanupArchiveHint: 'Enabled by default so `D:\\EnvPilot\\downloads` does not keep too many zip or exe files.',
      detectedInstalls: 'Detected installations',
      environmentBindings: 'Environment bindings',
      environmentBindingsBadge: (count: number) => `${count} bindings`,
      environmentBindingsNotActive: 'Not active',
      install: 'Install',
      installing: 'Installing…',
      managedCount: (count: number) => `${count} managed versions`,
      managedEmpty: 'No EnvPilot-managed version is installed yet.',
      managedVersions: 'EnvPilot-managed versions',
      noActiveVersionTip: 'No managed version is active yet, so EnvPilot is not writing bindings for this runtime.',
      noSystemRecord: 'No system install record was found, but the runtime may still be available from the command line.',
      selectedVendor: 'Java vendor',
      sharedEntryPointHint: 'The active version is always mapped to this stable path.',
      sharedEntryPointTitle: 'Stable entry point',
      switch: 'Switch',
      switchableVersion: 'Switchable',
      switching: 'Switching…',
      uninstallVersion: 'Uninstall version',
      uninstalling: 'Uninstalling…',
      vendorHint: 'Choose the Java distribution vendor before installing each version.',
      versionCatalog: 'Available versions',
      workflowStep1Title: 'Official package',
      workflowStep1Description: 'Downloads come from official sources, can reuse cached packages, and now show download and install as separate stages.',
      workflowStep2Title: 'Managed install directory',
      workflowStep2Description: 'Runtimes land in the managed directory on drive D and switch through a stable entry point.',
      workflowStep3Title: 'Environment activation',
      workflowStep3Description: 'After install, EnvPilot refreshes entry points, PATH, and language-specific variables immediately.',
    },
    workspace: {
      overview: { description: 'Review system baseline, directories, backups, and logs', title: 'Overview' },
      platform: { description: 'Manage WSL, Hyper-V, virtualization, and Docker', title: 'Virtualization & Docker' },
      settings: { description: 'Configure storage path, proxy, theme, and other app settings', title: 'App Settings' },
      software: { description: 'Recognize existing software on this machine and provide uninstall entries', title: 'Installed Software' },
      variables: { description: 'Scan, repair, and roll back PATH and environment issues', title: 'Variable Governance' },
      versions: { description: 'Install, switch, and manage multiple runtime versions', title: 'Runtime Versions' },
    },

    // --- Previously inline i18n entries ---

    progress: {
      workingTitle: 'Working on the current task',
      workingDetail: 'Refreshing download, install, or environment steps.',
      processing: 'Working',
    },

    confirm: {
      actionType: 'Action type',
      target: 'Target',
      uninstallProgram: {
        actionLabel: 'Uninstall software',
        confirmLabel: 'Confirm uninstall',
        description: 'This runs the uninstall command registered in Windows and follows that software\'s own removal flow.',
        title: 'Confirm software removal',
      },
      uninstallRuntime: {
        actionLabel: 'Remove managed version',
        confirmLabel: 'Confirm remove',
        description: 'This removes the selected runtime files from EnvPilot storage and updates the active-version mapping.',
        title: 'Confirm managed version removal',
      },
      uninstallDocker: {
        actionLabel: 'Uninstall Docker Desktop',
        confirmLabel: 'Confirm Docker removal',
        description: 'This triggers Docker Desktop\'s own uninstall flow. Windows feature switches are managed separately.',
        title: 'Confirm Docker Desktop removal',
      },
      disableFeature: {
        actionLabel: 'Disable Windows feature',
        confirmLabel: 'Confirm disable',
        description: 'This disables the selected Windows feature. A reboot may be required.',
        title: 'Confirm Windows feature disable',
      },
    },

    settings: {
      storageTitle: 'Storage Settings',
      workingDirectoryLabel: 'Working Directory',
      workingDirectoryPlaceholder: 'Leave empty for default path',
      workingDirectoryHint: 'EnvPilot stores runtimes, downloads, and backups in this directory.',
      cleanupArchiveLabel: 'Clean download cache after install',
      cleanupArchiveHint: 'Prevents D:\\EnvPilot\\downloads from accumulating too many zip/exe files.',
      proxyTitle: 'Proxy Settings',
      proxyEnabledLabel: 'Enable Proxy',
      proxyEnabledHint: 'Download packages through a proxy server.',
      proxyServerLabel: 'Proxy Server',
      usernameLabel: 'Username',
      usernamePlaceholder: 'Optional',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Optional',
      appearanceTitle: 'Appearance',
      themeLabel: 'Theme',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeSystem: 'System',
      languageLabel: 'Language',
      aboutTitle: 'About',
      aboutVersion: 'Version',
      aboutDescription: 'Windows environment automation tool',
      configImportTitle: 'Config Import/Export',
      configImportDescription: 'Export current config to file, or import config from file.',
      exportConfig: 'Export Config',
      exportingConfig: 'Exporting…',
      configExported: 'Config exported',
      importConfig: 'Import Config',
      importingConfig: 'Importing…',
      operationLogsTitle: 'Operation Logs',
      clearLogs: 'Clear Logs',
      clearingLogs: 'Clearing…',
      noLogs: 'No operation logs',
      backupManagementTitle: 'Backup Management',
      noBackups: 'No backup records',
      restoreBackup: 'Restore',
      deleteBackup: 'Delete',
      restoreConfirmTitle: 'Confirm backup restore',
      restoreConfirmLabel: 'Confirm restore',
      restoreConfirmDescription: 'This will restore environment variables to the state at the time of the backup.',
      restoreConfirmAction: 'Restore backup',
      deleteConfirmTitle: 'Confirm backup delete',
      deleteConfirmLabel: 'Confirm delete',
      deleteConfirmDescription: 'This will permanently delete the backup file.',
      deleteConfirmAction: 'Delete backup',
      diagnosticsTitle: 'Environment Diagnostics',
      runDiagnostics: 'Run Diagnostics',
      diagnosing: 'Diagnosing…',
      noDiagnostics: 'Click "Run Diagnostics" to check system environment status',
      diagnosticCategorySystem: 'System Info',
      diagnosticCategoryStorage: 'Storage Paths',
      diagnosticCategoryEnvironment: 'Environment Variables',
      diagnosticCategoryRuntimes: 'Runtime Detection',
      diagnosticCategoryNetwork: 'Network',
      saveSettings: 'Save Settings',
      savingSettings: 'Saving…',
    },

    platformVersion: 'Version',

    // Sidebar metrics (previously inline)
    softwareCountMetric: (count: number) => `${count} detected apps`,
    platformActiveMetric: (count: number) => `${count} active items`,
    settingsConfigMetric: 'Configuration',

    // Docker install label (previously inline in getToolInstallLabel)
    installDockerDesktop: 'Install Docker Desktop',
  },
} as const

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'zh-CN'
  }

  const savedLocale = window.localStorage.getItem('envpilot-locale')

  if (savedLocale === 'zh-CN' || savedLocale === 'en-US') {
    return savedLocale
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function getWorkspaceCards(dashboard: DashboardData, locale: Locale): WorkspaceCardCopy[] {
  const copy = uiCopy[locale]
  const managedCount = dashboard.managedRuntimes.reduce(
    (total, runtime) => total + runtime.installedVersions.length,
    0,
  )
  const toolCount = dashboard.systemTools.filter((tool) => tool.status === 'installed').length

  return [
    {
      description: copy.workspace.overview.description,
      group: 'core',
      id: 'overview',
      metric: copy.backupCountMetric(dashboard.backupHistory.length),
      title: copy.workspace.overview.title,
    },
    {
      description: copy.workspace.software.description,
      group: 'core',
      id: 'software',
      metric: copy.softwareCountMetric(dashboard.installedPrograms.length),
      title: copy.workspace.software.title,
    },
    {
      description: copy.workspace.versions.description,
      group: 'core',
      id: 'versions',
      metric: copy.versions.managedCount(managedCount),
      title: copy.workspace.versions.title,
    },
    {
      description: copy.workspace.platform.description,
      group: 'core',
      id: 'platform',
      metric: copy.platformActiveMetric(toolCount),
      title: copy.workspace.platform.title,
    },
    {
      description: copy.workspace.variables.description,
      group: 'governance',
      id: 'variables',
      metric: copy.variables.pendingCount(dashboard.pathIssues.length),
      title: copy.workspace.variables.title,
    },
    {
      description: copy.workspace.settings.description,
      group: 'governance',
      id: 'settings',
      metric: copy.settingsConfigMetric,
      title: copy.workspace.settings.title,
    },
  ]
}

export function isWindowsFeature(tool: SystemToolSummary): boolean {
  return tool.key !== 'docker'
}

export function getToolStatusLabel(tool: SystemToolSummary, locale: Locale): string {
  const copy = uiCopy[locale]

  if (tool.status === 'partial') {
    return copy.platform.statusPending
  }

  if (tool.key === 'docker') {
    return tool.status === 'installed'
      ? copy.platform.dockerInstalled
      : copy.platform.dockerNotInstalled
  }

  return tool.status === 'installed'
    ? copy.platform.statusEnabled
    : copy.platform.statusNotEnabled
}

export function getToolInstallLabel(tool: SystemToolSummary, locale: Locale): string {
  const copy = uiCopy[locale]
  return isWindowsFeature(tool) ? copy.platform.enableFeature : copy.installDockerDesktop
}

export function getToolUninstallLabel(tool: SystemToolSummary, locale: Locale): string {
  const copy = uiCopy[locale]
  return isWindowsFeature(tool) ? copy.platform.turnOffFeature : copy.platform.dockerUninstall
}

export function getToolSourceLabel(tool: SystemToolSummary, locale: Locale): string {
  const copy = uiCopy[locale]
  return isWindowsFeature(tool) ? copy.platform.systemFeature : copy.platform.desktopSoftware
}

export function getToolDescription(tool: SystemToolSummary, locale: Locale): string {
  const copy = uiCopy[locale]

  if (tool.key === 'wsl') {
    return copy.platform.wslDescription
  }

  if (tool.key === 'virtual-machine-platform') {
    return copy.platform.vmpDescription
  }

  if (tool.key === 'hyper-v') {
    return copy.platform.hypervDescription
  }

  return copy.platform.dockerDescription
}

export function getToolNotes(tool: SystemToolSummary, locale: Locale): string {
  const copy = uiCopy[locale]

  if (tool.key === 'wsl') {
    if (tool.status === 'installed') {
      return tool.notes?.toLowerCase().includes('stopped')
        ? copy.platform.wslInstalledStopped
        : copy.platform.wslInstalledRunning
    }

    return copy.platform.wslMissing
  }

  if (tool.key === 'docker') {
    return tool.status === 'installed'
      ? copy.platform.dockerInstalled
      : copy.platform.dockerNotInstalled
  }

  return copy.platform.turnOffFeatureNote
}
