# k6 性能测试入门实操手册

从零开始学 [k6](https://k6.io/) 性能测试框架的循序渐进教程,每一章都包含:概念讲解、带 `TODO` 的练习脚本(`exercise.js`)、对照答案(`solution.js`)、以及**本地实测得到的真实预期输出**(不是编的)。

## 怎么用这份手册

按顺序过一遍每个章节的文件夹:

1. 读该章 `README.md` 里的概念讲解
2. 打开 `exercise.js`,按 `TODO` 补全代码
3. 用 `k6 run exercise.js` 运行,对照 README 里的"预期输出"核对
4. 卡住了就看 `solution.js`

## 章节

| 章节 | 内容 |
|---|---|
| [`00-install`](./00-install/) | Windows 上安装 k6 |
| [`01-first-script`](./01-first-script/) | 第一个脚本、VU 与 iteration |
| [`02-checks`](./02-checks/) | `check()` 响应校验 |
| [`03-stages`](./03-stages/) | `stages` 爬坡式压测 |
| [`04-thresholds`](./04-thresholds/) | `thresholds` 通过/失败标准、CI 退出码 |
| [`05-metrics-and-data`](./05-metrics-and-data/) | 自定义指标 + `SharedArray` 数据参数化 |
| [`06-scenarios`](./06-scenarios/) | 多场景组合、closed vs open model 执行器 |
| [`07-real-api`](./07-real-api/) | 切换到自己的真实接口做实战 |

## 练习目标接口

`01`~`06` 章都打 [QuickPizza](https://github.com/grafana/quickpizza)——Grafana 官方为 k6 教程搭建的公开演示应用(`test.k6.io` 现已重定向到这里)。这是一个允许轻量压测的公共靶场,但：

- 前几章(`01`/`02`)VU 数很小,直接打公共站没问题
- 从 `04-thresholds` 章节末尾开始,建议切换到本地 Docker 跑的 QuickPizza,获得稳定、可复现的数据,也避免给公共演示站增加不必要的负担:

  ```powershell
  docker run --rm -it -p 3333:3333 ghcr.io/grafana/quickpizza-local:latest
  ```

  所有 `05`/`06` 章的脚本都支持 `-e BASE_URL=http://localhost:3333` 切换目标。

**这也是一条通用原则:只对你有权限、能控制的系统做有强度的压测。** 公共演示站适合验证语法,真正的压力测试必须在自己搭建或获得授权的环境里进行。

## 环境要求

- Windows 10/11(手册按 Windows 环境写的运行命令,PowerShell)
- k6(见 `00-install`)
- 可选:Docker Desktop(跑本地 QuickPizza)
