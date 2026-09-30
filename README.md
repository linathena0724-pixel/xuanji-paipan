# xuanji-paipan · 玄玑排盘服务

输入生辰，返回八字排盘和图表数据（四柱表、五行能量环、十神占比、神煞图谱、大运流年分数）。前端只负责画，不做任何计算。

基于 [mingyu-core](https://github.com/Brhiza/mingyu)（AGPL-3.0-only），本仓库同样以 AGPL-3.0-only 发布。

## 运行

需要 Node.js 18 以上。

```bash
npm ci
npm test            # 单元测试（全部为虚构生辰）
npm start           # 默认端口 8080
```

环境变量：

| 变量 | 说明 |
|---|---|
| `PORT` | 监听端口，默认 8080 |
| `PAIPAN_TOKEN` | 设置后，`/v1/bazi` 要求 `Authorization: Bearer <token>` |

## 接口

### `GET /v1/health`

```json
{ "ok": true, "engine": "mingyu-core@0.3.0", "config": "2026-09-30.v1.4" }
```

### `POST /v1/bazi`

请求体（JSON，最大 4KB）。网址不能带任何查询参数（`?` 后面的部分），带了一律拒绝，免得生辰进入代理或网关的访问日志：

| 字段 | 必填 | 说明 |
|---|---|---|
| `date` | 是 | 公历 `YYYY-MM-DD` |
| `time` | 否 | `HH:mm`；时辰不详传 `null`，按三柱排盘，时柱返回 `null`，不默认任何时辰 |
| `city` | 是 | 中国省市区名称或行政区代码，用于真太阳时经度校正 |
| `gender` | 是 | `male` / `female`，没有默认值 |
| `timeMode` | 否 | `true_solar`（默认，按出生地经度和均时差校正）或 `clock`（直接用北京时间） |

返回（节选）：

```jsonc
{
  "version": { "api": "v1", "engine": "mingyu-core@0.3.0", "config": "2026-09-30.v1.4" },
  "input": { "date", "time", "city", "longitude", "gender", "timeKnown", "trueSolarTime" },
  "warnings": [],                      // 节气交界、时辰交界等提示（中文，可直接给用户看）
  "timeCheck": { "mode", "pillars", "other": { "mode", "pillars" }, "differs" },
                                        // 两种时间口径排出的日柱＋时柱；differs 为 true 时 warnings 里有一句交界提示
  "bazi": {
    "pillars": { "year": {...}, "month": {...}, "day": {...}, "hour": {...} | null },
                                        // 每柱：干支、十神、藏干及十神、纳音、空亡、地势、自坐、神煞
    "dayMaster": { "gan", "element", "yinYang" },
    "strength": "身强",
    "pattern": { "name", "isSpecial", "status" },
    "usefulGods": { "favorableWuxing", "unfavorableWuxing", "primaryFavorableWuxing", ... },
    "luck": { "startInfo", "cycles": [{ "seq", "ganZhi", "startAge", "endAge", "startYear", "endYear",
                                         "score", "tier", "years": [{ "year", "age", "ganZhi", "score", "tier" }] }] }
  },
  "components": {
    "dayMasterCard": { "dayGanZhi", "gan", "element", "yinYang" },
    "wuxingRing": { "type", "range", "dominant", "dayMasterElement", "rows": [{ "element", "percent", "exact", "tenGods" }] },
    "tenGodBar": { "total", "sum", "rows": [{ "tenGod", "count", "percent" }] },
    "shenshaPanel": { "featured": [...], "dimensions": [{ "key", "name", "score", "tier", "shensha" }], "all": [...] }
  }
}
```

`tier` 是档位序号，0 为最高档。本服务只返回数字和档位，不含任何判词文案。

错误都返回 JSON：`{ "error": { "code", "message" } }`。

| 状态码 | code | 情况 |
|---|---|---|
| 400 | `QUERY_NOT_ALLOWED` | 网址带了查询参数 |
| 400 | `BAD_JSON` | 请求体不是合法 JSON |
| 400 | `DATE_REQUIRED`、`TIME_INVALID`、`GENDER_REQUIRED`、`CITY_REQUIRED`、`LOCATION_NOT_FOUND`、`TIME_MODE_INVALID`、`ENGINE_REJECTED` | 输入有问题 |
| 401 | `UNAUTHORIZED` | 设了 `PAIPAN_TOKEN` 但请求没带对 |
| 413 | `BODY_TOO_LARGE` | 请求体超过 4KB |

## 算法口径

所有权重和阈值在 `src/config.js`，改口径只改这一个文件，并升 `CONFIG_VERSION`（当前 `2026-09-30.v1.4`）。测试会检查本 README 写的版本号和五行权重跟代码一致。

- **五行能量环**：天干每字 1；三个藏干的地支按本气、中气、余气 0.5 / 0.25 / 0.05，两个藏干的地支 0.7 / 0.3，一个藏干的地支 1；日主计入；取整后残差归最大项。
- **十神占比**：天干、藏干每个 1，日主不计；每项去尾取整，总和可以不足 100。
- **神煞图谱**：七个维度，组内命中神煞的权重相加，封顶 99，没有命中的维度不返回。
- **类型标签**：强度分 = 月令（扶身 25／相持 20／制身 10）＋ 通根（强根 40／有根 10／无根 0）＋ 得势（扶身 20／相持 10／制身 0），三项取自引擎的身强弱判断；≥80 极强型、60～79 身强型、55～59 均衡型、<55 偏弱型。引擎没给身强弱（如时辰不详）时不给标签。
- **神煞查法**：默认用引擎的问真口径；德秀贵人取引擎古法口径；天乙贵人用「庚辛逢马虎」版；学堂按年柱、日柱纳音各查一次。
- **大运流年**：`70 + 8×(干喜忌 + 支喜忌)`，夹在 35～98，地支取本气，喜忌来自引擎的喜用神判断；档位 ≥90 / 75 / 60 / 45。每步大运的 `years` 正好是 `startYear`～`endYear` 这十年，跟下一步不重叠。

## 时间口径

默认按真太阳时排：北京时间按出生地经度校正，再加上当天的均时差；1986–1991 年的夏令时由引擎按历史时区处理。
传 `timeMode: "clock"` 就直接按北京时间排，只用钟表时间的软件都是这样排的。
每次排盘都会用另一种口径再算一遍日柱和时柱，结果不同就在 `warnings` 里加一句提示。出生时间离时辰交界比较近时，常会出现这种情况。

## 对上游的修正

- **劫煞、亡神**：mingyu-core 0.3.0 的查法表在「亥卯未」「巳酉丑」两组互换了。本服务按三合局古法重算（劫煞在局之绝地、亡神在局之临官），见 `src/shenshaFix.js`。
- **神煞口径**：常用神煞（common）和全量神煞（all）两套名字不同，本服务以常用为主，只从全量中补入图谱需要打分的项目（如六厄）。

## 隐私

- 服务无状态，不连数据库，不做缓存。
- 日志只记录方法、路径、状态码和耗时，请求体（生辰）不写入日志。
- 生辰只能通过 POST 请求体传入，不接受 URL 参数。
- 测试数据全部为虚构生辰。

## 更多文档

- `docs/api-example.json`：一次完整返回的示例（虚构生辰，大运只截了前两步）。
- `docs/UPSTREAM.md`：上游依赖、许可证，以及本服务对引擎结果做的修正。
- `docs/KNOWN_ISSUES.md`：已知问题。

## 许可证

AGPL-3.0-only，全文见 `LICENSE`。本服务调用的排盘引擎为 mingyu-core 0.3.0（© 原作者，AGPL-3.0-only）；`src/` 下的服务层代码由玄玑编写。
