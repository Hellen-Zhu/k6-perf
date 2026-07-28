# 00 · 安装 k6(Windows)

## 方式一:winget(推荐,Windows 10 2004+ / Windows 11 自带)

以管理员或普通用户身份打开 PowerShell:

```powershell
winget install k6 --source winget
```

## 方式二:Chocolatey

如果你已经装了 [Chocolatey](https://chocolatey.org/install):

```powershell
choco install k6
```

## 方式三:手动下载二进制

1. 打开 [k6 GitHub Releases](https://github.com/grafana/k6/releases)
2. 下载 `k6-vX.X.X-windows-amd64.zip`
3. 解压后把 `k6.exe` 所在目录加入系统 `PATH` 环境变量

## 验证安装

关闭并重新打开一个新的 PowerShell 窗口(让 PATH 生效),运行:

```powershell
k6 version
```

预期类似输出(版本号可能不同,不用完全一致):

```
k6 v2.1.0 (commit/devel, go1.26.4, windows/amd64)
```

看到版本号即安装成功。

## 自查清单

- [ ] `k6 version` 能正常输出版本号
- [ ] 新开一个终端窗口也能直接运行 `k6`(确认 PATH 是永久生效,不是临时的)

装好后进入 [`01-first-script`](../01-first-script/) 开始第一课。
