# 世界赛选手数据口径

本版支持已结束的 **S11 / 2021、S12 / 2022、S13 / 2023、S14 / 2024**。每届收录该届世界赛**实际上场的全部选手**，包括入围赛和上场替补；不将未登场的注册替补、教练或区域资格赛选手混入选手池。所有人物与原队归属以对应赛季为准。

| 赛季 | 参赛队 | 正赛队 | 上场选手 | 实际比赛局数 |
| --- | ---: | ---: | ---: | ---: |
| 2021 / S11 | 22 | 16 | 113 | 121 |
| 2022 / S12 | 24 | 16 | 124 | 127 |
| 2023 / S13 | 22 | 16 | 110 | 110 |
| 2024 / S14 | 20 | 16 | 101 | 106 |
| 合计 | 88 份赛季战队档案 | 64 | 448 份赛季选手档案 | 464 |

“448”包含同一选手的跨年版本，不表示448个不同自然人。`identity` 在四季间统一，`id` 包含赛季，支持分期估值与重复人物校验。2021 Xiaohu 的位置为上路；之后的档案为中路。

## 可抽取的赛区池

每轮随机一个赛季，再随机该届一个可用赛区，仅从本轮赛区池的实际世界赛选手中无放回抽6人；每次成功签约后重新随机下一轮的赛季和赛区。队伍可跨年跨区，成员保留被抽中赛季的能力；已入队人物的所有跨年版本从后续抽选中排除，尚未签约的人物可以在之后再次出现。为保证任意一轮排除最多5名已签约人物后仍有6位候选，池内至少需要11个不同人物。所有小赛区仍保留完整数据，但不足11人的组合不参与随机签。界面以可抽组合为准，不将数据覆盖范围写成所有赛区均可抽取。第六人签约后不再抽签，最终统一按2026（S16）正赛规则结算，战队归属沿用第六轮赛区；对手采用S14历史阵容模拟。

| 赛季 | LPL | LCK | LEC | LCS | PCS | 其他已收录赛区 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2021 | 20 | 21 | 15 | 15 | 11 | CBLOL 6；LJL / TCL / LLA / LCO / LCL 各5 |
| 2022 | 20 | 21 | 21 | 15 | 12 | VCS 10；CBLOL / LJL / TCL / LLA / LCO 各5 |
| 2023 | 20 | 20 | 20 | 15 | 10 | VCS 10；CBLOL / LJL / LLA 各5 |
| 2024 | 21 | 20 | 15 | 15 | 10 | VCS 10；CBLOL / LLA 各5 |

2021/2022 的 LEC 是当时的欧洲赛区；2023起为 EMEA（欧洲、中东及非洲）。2024 SHG 经 PCS 路径取得世界赛资格，归于当届 PCS 池，而非按队员国籍分池。越南战队未参加2021世界赛，故该年没有 VCS 池。

## 名单与统计来源

基础来源为 [Oracle’s Elixir 逐场比赛数据](https://lol.timsevenhuysen.com/matchdata/)，字段含义见其[数据字典](https://lol.timsevenhuysen.com/matchdata/match-data-dictionary/)。原发布站与旧S3下载地址在本次采集时返回403，因此使用下列公开CSV镜像；这些镜像转载OE原始数据，不将镜像作者作为官方评分机构：

- [2021 / gregvoigts](https://github.com/gregvoigts/bachelor-arbeit/blob/main/2021_LoL_esports_match_data_from_OraclesElixir.csv)
- [2022 / stvngo](https://github.com/stvngo/LoL-Statistical-Analysis/blob/main/2022_LoL_esports_match_data_from_OraclesElixir.csv)
- [2023 / Ashalo](https://github.com/Ashalo/LOLAnalysis/blob/main/2023_LoL_esports_match_data_from_OraclesElixir.csv)
- [2024 / JianyunYe](https://github.com/JianyunYe/League-of-Legends-data-analysis/blob/main/2024_LoL_esports_match_data_from_OraclesElixir.csv)

赛事统计核对入口：

- [2021 正赛统计](https://gol.gg/tournament/tournament-stats/Worlds%20Main%20Event%202021/) / [入围赛统计](https://gol.gg/tournament/tournament-stats/Worlds%20Play-In%202021/)
- [2022 正赛统计](https://gol.gg/tournament/tournament-stats/Worlds%20Main%20Event%202022/) / [入围赛统计](https://gol.gg/tournament/tournament-stats/Worlds%20Play-In%202022/)
- [2023 正赛统计](https://gol.gg/tournament/tournament-stats/Worlds%20Main%20Event%202023/) / [入围赛统计](https://gol.gg/tournament/tournament-stats/Worlds%20Play-In%202023/)
- [2024 正赛统计](https://gol.gg/tournament/tournament-stats/Worlds%20Main%20Event%202024/) / [入围赛统计](https://gol.gg/tournament/tournament-stats/Worlds%20Play-In%202024/)

处理脚本 `scripts/worlds-fetch.py` 下载并缓存WCS/WLDs记录，`scripts/worlds-build.py` 生成离线数据。构建不需要联网；仅更新数据时需要运行抓取脚本。采集日期：2026-11-10。

清洗要点：

1. WLDs 标签也包含某些赛区的区域资格赛与2023世界赛资格系列赛（WQS）。分别按2021-10-05、2022-09-29、2023-10-10、2024-09-25及之后的记录限定世界赛本体，避免把未晋级的Rookie、Prince、Golden Guardians等选手错误计入。
2. `mainEvent` 由实际出现在对应正赛开始日期（2021-10-11、2022-10-07、2023-10-19、2024-10-03）之后的队伍自动判断，每季必须严格16队。它表示历史正赛资格，不预定模拟赛果。
3. 使用该届历史队名：2022 Dplus KIA 更正为 DWG KIA；2022 MAD Lions KOI 更正为 MAD Lions。2024 MAD Lions KOI 使用 MDK 缩写。
4. OE存在后来的ID回填：2021 `1116` 恢复为参赛时的 `Maoan`；`MDB` 恢复为 `Argonavt`。其他大小写与空格统一到稳定身份ID。
5. 纳入所有实际上场替补：2021 Burdol、PK、Avenger；2022 Liang、Atlen、Juhan、Rhuckz；2024 Wei / Xun。2023没有额外上场替补。同一人跨位置登场时只计一张档案，以该届出场最多的位置为本职。

## 六维与游戏评分

**所有0–100分、综合分、标签与战队强度均为本demo的游戏设计估值，不是拳头官方能力值、真实历史统计或客观心理评估。** 数值参考对应届赛事的实际对线、输出、参团、视野和稳定表现；同一人的不同赛季可以不同。

每份档案保留 `sourceStats`：出场局数、胜率、KDA、每分钟伤害、15分钟经济差、15分钟补刀差、参团率和每分钟视野，便于回查来源。`stats` 中的六维则是转换后的游戏属性：

| 属性 | 设计依据 |
| --- | --- |
| 操作 mechanics | 同位置的对线、伤害效率、每分钟输出和KDA，加少量该届风格调整 |
| 对线 laning | 同位置的15分钟经济差和补刀差；打野对应前期野区对抗 |
| 团战 teamfight | 同位置伤害效率、每分钟伤害、参团率和KDA，兼顾该届关键团战表现 |
| 运营 macro | 同位置的参团、视野、胜率和伤害效率；指挥职责采用有限人工校准 |
| 视野 vision | 同位置每分钟视野表现，叠加各岗位基准 |
| 稳定 mentality | 死亡频率、KDA和参团率的表现代理，不宣称测量真实心态 |

默认数值按**该届世界赛、本职位置**分别做百分位转换，再围绕岗位基准生成属性；不会直接比较辅助与ADC的伤害。伤害效率使用伤害占比除以所得经济占比，避免把队伍资源投入全部算作个人输出能力。对手平均强度、入围赛出场占比及原队表现只作小幅修正，原队强度不再作为六项属性的共同底分。

全部表现修正都按 `出场局数 / (出场局数 + 4)` 向岗位基准收缩，包括人工风格修正；2–3局替补不会继承冠军队的顶尖综合分。少量档案保留该届指挥、操作或团战专长的目标值，每份最多两项，仍须接受短样本收缩；决赛MVP不会自动获得六维高分或“稳定99”。

综合分与游戏引擎采用相同的本职位置加权与舍入方式。上路、中路、下路侧重操作、对线和团战；打野、辅助更重运营和视野。每个版本只反映对应届世界赛，既不是全年评级，也不把历史巅峰复制到所有年份。

历史对手战队强度也由这套选手属性重新生成：各位置取实际出场最多者，同局数按ID排序；余下选手中出场最多者作为替补。使用与玩家阵容相同的位置分、几何平均、同队熟练度、野辅协同及替补加成公式，避免对手仍留在旧的95–98分尺度。没有实际上场替补的历史队伍不凭空补人。

2026-11-10 的复核覆盖全部448份赛季选手档案、2688项属性与88份战队档案，具体分布及代表修订见 [评分复核记录](./rating-review.md)。保留所有原始 `sourceStats`、人物身份和赛季原队归属。统计代理仍受英雄、版本、资源分配及队友影响；该估值服务于选秀玩法与阵容取舍，不用于现实竞技排名、心理判断或赛事预测。
