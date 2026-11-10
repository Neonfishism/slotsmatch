// 原作设定用于身份与特长；八维数值与角色权重均为本游戏估值，不是官方能力评分。
// 以各人的常规作战状态集结，不采用六道、秽土转生、八门遁甲终极形态。
export const STAT_KEYS = ['nin', 'tai', 'gen', 'int', 'str', 'spd', 'sta', 'seal'];

export const STAT_LABELS = {
  nin: '忍术', tai: '体术', gen: '幻术', int: '智谋',
  str: '力量', spd: '速度', sta: '查克拉', seal: '结印',
};

export const VILLAGES = [
  { id: 'leaf', name: '木叶隐村', english: 'HIDDEN LEAF', kanji: '葉', element: '火之国', description: '传承火之意志，擅长多样忍术与小队配合。', color: '#d38b3f' },
  { id: 'sand', name: '砂隐村', english: 'HIDDEN SAND', kanji: '砂', element: '风之国', description: '以砂、风遁与傀儡术掌控战场距离。', color: '#d6b16f' },
  { id: 'mist', name: '雾隐村', english: 'HIDDEN MIST', kanji: '霧', element: '水之国', description: '水遁、隐蔽与忍刀，在迷雾中寻找破绽。', color: '#85b8c3' },
  { id: 'cloud', name: '云隐村', english: 'HIDDEN CLOUD', kanji: '雲', element: '雷之国', description: '雷遁与高速近身战，重视正面压制。', color: '#a6a0db' },
  { id: 'stone', name: '岩隐村', english: 'HIDDEN STONE', kanji: '岩', element: '土之国', description: '土遁筑起坚实阵线，空中忍术改变攻势。', color: '#b88774' },
];

export const ROLES = [
  {
    id: 'captain', name: '队长', description: '以智谋统筹全队，兼顾忍术、判断与应变。',
    weights: { nin: 0.15, tai: 0.05, gen: 0.10, int: 0.40, str: 0, spd: 0.10, sta: 0.10, seal: 0.10 },
  },
  {
    id: 'scout', name: '侦察', description: '依靠速度与判断抢占情报，隐蔽和感知特长另有配合价值。',
    weights: { nin: 0.15, tai: 0.05, gen: 0.15, int: 0.25, str: 0, spd: 0.30, sta: 0.05, seal: 0.05 },
  },
  {
    id: 'assault', name: '突破', description: '以忍术、体术和力量破开阵线，速度决定先手。',
    weights: { nin: 0.25, tai: 0.25, gen: 0, int: 0.05, str: 0.20, spd: 0.15, sta: 0.10, seal: 0 },
  },
  {
    id: 'support', name: '支援', description: '以忍术、查克拉和结印支撑战线，医疗与封印特长丰富战术。',
    weights: { nin: 0.25, tai: 0, gen: 0.10, int: 0.20, str: 0, spd: 0.05, sta: 0.20, seal: 0.20 },
  },
];

export const NINJAS = [
  {
    id: 'naruto', name: '鸣人', alias: '意外性第一', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 84, tai: 76, gen: 18, int: 58, str: 78, spd: 76, sta: 98, seal: 45 },
    tags: ['assault', 'guard'], specialty: '影分身制造人数与佯攻优势，螺旋丸擅长近身破局；充沛查克拉支持持续战。', bond: 'team7', rogue: false, glyph: '鳴',
  },
  {
    id: 'sasuke', name: '佐助', alias: '雷光孤影', village: 'leaf', version: '疾风传·鹰小队',
    stats: { nin: 88, tai: 82, gen: 84, int: 82, str: 65, spd: 91, sta: 72, seal: 82 },
    tags: ['assault', 'stealth', 'ranged'], specialty: '写轮眼辅助洞察与幻术，雷遁、火遁和剑术可在不同距离切换攻势。', bond: 'team7', rogue: true, glyph: '佐',
  },
  {
    id: 'sakura', name: '小樱', alias: '樱色铁拳', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 77, tai: 78, gen: 41, int: 86, str: 95, spd: 65, sta: 78, seal: 86 },
    tags: ['medical', 'assault'], specialty: '精准查克拉控制服务于医疗忍术与怪力，在治疗之外也能近身破阵。', bond: 'team7', rogue: false, glyph: '櫻',
  },
  {
    id: 'kakashi', name: '卡卡西', alias: '拷贝忍者', village: 'leaf', version: '疾风传·单写轮眼',
    stats: { nin: 88, tai: 80, gen: 76, int: 95, str: 59, spd: 85, sta: 55, seal: 94 },
    tags: ['tactics', 'stealth', 'assault'], specialty: '以写轮眼观察、分身试探与多属性忍术拆解敌方战术；高强度作战受查克拉储备限制。', bond: 'team7', rogue: false, glyph: '写',
  },
  {
    id: 'shikamaru', name: '鹿丸', alias: '影之军师', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 68, tai: 43, gen: 48, int: 99, str: 34, spd: 58, sta: 48, seal: 81 },
    tags: ['tactics', 'guard', 'stealth'], specialty: '影子模仿术控制敌人行动，擅长预判、诱导与安排连锁配合。', bond: 'team10', rogue: false, glyph: '影',
  },
  {
    id: 'hinata', name: '雏田', alias: '白眼守望', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 63, tai: 76, gen: 30, int: 68, str: 43, spd: 64, sta: 61, seal: 57 },
    tags: ['sensor', 'guard'], specialty: '白眼提供广域观察与查克拉识别，柔拳可针对敌人的经络与查克拉流动。', bond: 'hyuga', rogue: false, glyph: '瞳',
  },
  {
    id: 'neji', name: '宁次', alias: '日向天才', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 69, tai: 92, gen: 31, int: 81, str: 55, spd: 81, sta: 66, seal: 62 },
    tags: ['sensor', 'guard', 'assault'], specialty: '白眼和柔拳负责观察与点穴，回天适合应对多方向攻击、保护阵线。', bond: 'teamGuy', rogue: false, glyph: '寧',
  },
  {
    id: 'lee', name: '小李', alias: '努力的天才', village: 'leaf', version: '疾风传·常规体术',
    stats: { nin: 4, tai: 97, gen: 3, int: 51, str: 87, spd: 95, sta: 86, seal: 5 },
    tags: ['assault'], specialty: '以高速体术和扎实身体能力连续压迫对手，本版本不计入高阶八门爆发。', bond: 'teamGuy', rogue: false, glyph: '李',
  },
  {
    id: 'tsunade', name: '纲手', alias: '传说的医疗忍者', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 88, tai: 88, gen: 50, int: 90, str: 99, spd: 62, sta: 88, seal: 92 },
    tags: ['medical', 'assault', 'guard'], specialty: '医疗忍术、怪力和蛞蝓通灵兼顾重击与群体支援，是长线作战的可靠核心。', bond: 'sannin', rogue: false, glyph: '綱',
  },
  {
    id: 'jiraiya', name: '自来也', alias: '豪杰蛤蟆', village: 'leaf', version: '生前·常规',
    stats: { nin: 92, tai: 79, gen: 47, int: 88, str: 83, spd: 71, sta: 92, seal: 87 },
    tags: ['seal', 'tactics', 'ranged'], specialty: '蛤蟆通灵、火遁与封印术覆盖多种战局，经验丰富；不采用仙人模式加成。', bond: 'sannin', rogue: false, glyph: '豪',
  },
  {
    id: 'yamato', name: '大和', alias: '木遁守卫', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 81, tai: 61, gen: 37, int: 81, str: 62, spd: 63, sta: 75, seal: 85 },
    tags: ['guard', 'seal', 'tactics'], specialty: '木遁可制造掩体、拘束目标和重塑地形，也能辅助压制尾兽查克拉。', bond: 'team7', rogue: false, glyph: '木',
  },
  {
    id: 'itachi', name: '鼬', alias: '月下幻鸦', village: 'leaf', version: '生前·常规',
    stats: { nin: 87, tai: 74, gen: 98, int: 96, str: 48, spd: 89, sta: 43, seal: 96 },
    tags: ['stealth', 'tactics', 'ranged'], specialty: '写轮眼幻术、乌鸦分身和手里剑术善于制造破绽；本版本保留生前体力短板。', bond: 'akatsuki', rogue: true, glyph: '鼬',
  },
  {
    id: 'gaara', name: '我爱罗', alias: '砂之守护', village: 'sand', version: '疾风传·风影',
    stats: { nin: 91, tai: 43, gen: 31, int: 82, str: 46, spd: 54, sta: 87, seal: 82 },
    tags: ['guard', 'seal', 'ranged'], specialty: '操砂形成远距离压制与多层防护，擅长守护队友、封锁空间。', bond: 'sandSiblings', rogue: false, glyph: '砂',
  },
  {
    id: 'temari', name: '手鞠', alias: '镰鼬之风', village: 'sand', version: '疾风传·常规',
    stats: { nin: 82, tai: 47, gen: 32, int: 84, str: 52, spd: 62, sta: 66, seal: 73 },
    tags: ['ranged', 'tactics'], specialty: '巨扇配合风遁进行大范围切割和牵制，以距离判断为队友争取进攻窗口。', bond: 'sandSiblings', rogue: false, glyph: '風',
  },
  {
    id: 'kankuro', name: '勘九郎', alias: '傀儡操演', village: 'sand', version: '疾风传·常规',
    stats: { nin: 78, tai: 38, gen: 39, int: 81, str: 37, spd: 56, sta: 62, seal: 86 },
    tags: ['ranged', 'tactics', 'guard'], specialty: '以查克拉线操纵傀儡，利用暗器、毒和机关设置进攻陷阱。', bond: 'sandSiblings', rogue: false, glyph: '傀',
  },
  {
    id: 'chiyo', name: '千代', alias: '十指傀儡师', village: 'sand', version: '生前·常规',
    stats: { nin: 87, tai: 59, gen: 53, int: 94, str: 28, spd: 52, sta: 56, seal: 97 },
    tags: ['medical', 'tactics', 'ranged', 'guard'], specialty: '老练的傀儡术可兼顾攻守，对毒与解毒有丰富经验，身体与查克拉续航受年龄制约。', bond: 'puppetMasters', rogue: false, glyph: '千',
  },
  {
    id: 'baki', name: '马基', alias: '砂隐教官', village: 'sand', version: '疾风传·常规',
    stats: { nin: 72, tai: 64, gen: 37, int: 79, str: 60, spd: 70, sta: 66, seal: 76 },
    tags: ['tactics', 'ranged'], specialty: '风遁风之刃适合近中距离突袭，经验和执行力有助于稳定小队阵形。', bond: null, rogue: false, glyph: '刃',
  },
  {
    id: 'mei', name: '照美冥', alias: '双血继水影', village: 'mist', version: '疾风传·五代水影',
    stats: { nin: 94, tai: 48, gen: 43, int: 86, str: 48, spd: 65, sta: 79, seal: 89 },
    tags: ['ranged', 'guard', 'tactics'], specialty: '水遁、熔遁与沸遁覆盖大范围区域，擅长逼迫走位并限制敌人接近。', bond: 'mistEscort', rogue: false, glyph: '溶',
  },
  {
    id: 'zabuza', name: '再不斩', alias: '雾隐鬼人', village: 'mist', version: '生前·常规',
    stats: { nin: 79, tai: 84, gen: 32, int: 79, str: 88, spd: 73, sta: 70, seal: 80 },
    tags: ['stealth', 'assault'], specialty: '雾隐之术配合无声杀人术，在视野受限时用斩首大刀制造致命近身威胁。', bond: null, rogue: true, glyph: '斬',
  },
  {
    id: 'suigetsu', name: '鬼灯水月', alias: '水化忍刀手', village: 'mist', version: '疾风传·鹰小队',
    stats: { nin: 77, tai: 71, gen: 18, int: 58, str: 78, spd: 66, sta: 74, seal: 49 },
    tags: ['guard', 'assault', 'stealth'], specialty: '水化之术让身体液化以回避实体攻击，配合忍刀近战；雷遁是明显弱点。', bond: 'taka', rogue: true, glyph: '水',
  },
  {
    id: 'kisame', name: '鬼鲛', alias: '无尾之尾兽', village: 'mist', version: '生前·常规',
    stats: { nin: 90, tai: 85, gen: 22, int: 73, str: 94, spd: 66, sta: 99, seal: 76 },
    tags: ['assault', 'ranged', 'guard'], specialty: '庞大查克拉支撑大规模水遁，鲛肌可吸收查克拉，善于将战斗拖入消耗。', bond: 'akatsuki', rogue: true, glyph: '鮫',
  },
  {
    id: 'chojuro', name: '长十郎', alias: '双刀继承者', village: 'mist', version: '疾风传·水影护卫',
    stats: { nin: 60, tai: 80, gen: 26, int: 62, str: 77, spd: 68, sta: 67, seal: 48 },
    tags: ['assault', 'guard'], specialty: '双刀鲆鲽将查克拉转为武器形态，适合护卫与正面近战。', bond: 'mistEscort', rogue: false, glyph: '双',
  },
  {
    id: 'ao', name: '青', alias: '白眼看破', village: 'mist', version: '疾风传·水影护卫',
    stats: { nin: 63, tai: 51, gen: 55, int: 89, str: 43, spd: 58, sta: 55, seal: 73 },
    tags: ['sensor', 'tactics'], specialty: '移植白眼有助于识别查克拉与看破幻术线索，适合情报判断和感知协作。', bond: 'mistEscort', rogue: false, glyph: '青',
  },
  {
    id: 'ay', name: '艾', alias: '雷铠雷影', village: 'cloud', version: '疾风传·四代雷影',
    stats: { nin: 77, tai: 97, gen: 23, int: 71, str: 98, spd: 98, sta: 86, seal: 42 },
    tags: ['assault', 'guard'], specialty: '雷遁查克拉模式强化速度与防御，以高速体术和强力近身攻击突破敌阵。', bond: 'abBrothers', rogue: false, glyph: '雷',
  },
  {
    id: 'bee', name: '奇拉比', alias: '七刀流说唱客', village: 'cloud', version: '疾风传·常规人形',
    stats: { nin: 78, tai: 95, gen: 35, int: 69, str: 90, spd: 86, sta: 97, seal: 55 },
    tags: ['assault', 'seal', 'guard'], specialty: '多刀流与雷遁形成难以预测的近战节奏，墨分身可牵制封印；不计完整尾兽化。', bond: 'abBrothers', rogue: false, glyph: '比',
  },
  {
    id: 'darui', name: '达鲁伊', alias: '黑雷岚遁', village: 'cloud', version: '疾风传·雷影护卫',
    stats: { nin: 86, tai: 76, gen: 29, int: 82, str: 65, spd: 77, sta: 73, seal: 80 },
    tags: ['ranged', 'assault', 'tactics'], specialty: '黑雷和岚遁覆盖中远距离，刀术补足近战，能冷静处理复杂局势。', bond: 'cloudEscort', rogue: false, glyph: '嵐',
  },
  {
    id: 'shee', name: '希', alias: '感知与闪光', village: 'cloud', version: '疾风传·雷影护卫',
    stats: { nin: 65, tai: 39, gen: 78, int: 84, str: 32, spd: 63, sta: 57, seal: 80 },
    tags: ['sensor', 'medical', 'tactics'], specialty: '兼具感知、医疗和雷遁幻术，闪光可扰乱敌人视野，为队友争取反应时间。', bond: 'cloudEscort', rogue: false, glyph: '希',
  },
  {
    id: 'samui', name: '萨姆依', alias: '冷静的云忍', village: 'cloud', version: '疾风传·常规',
    stats: { nin: 56, tai: 64, gen: 34, int: 85, str: 48, spd: 61, sta: 58, seal: 63 },
    tags: ['tactics', 'guard'], specialty: '执行任务时保持冷静、重视情报核实，擅长组织同伴与配合行动。', bond: 'teamSamui', rogue: false, glyph: '静',
  },
  {
    id: 'onoki', name: '大野木', alias: '两天秤', village: 'stone', version: '疾风传·三代土影',
    stats: { nin: 98, tai: 28, gen: 47, int: 96, str: 32, spd: 52, sta: 59, seal: 96 },
    tags: ['ranged', 'guard', 'tactics'], specialty: '尘遁提供高威胁远程攻击，轻重岩之术改变机动与负重；年迈限制身体续航。', bond: 'stoneEscort', rogue: false, glyph: '塵',
  },
  {
    id: 'kurotsuchi', name: '黑土', alias: '熔遁岩花', village: 'stone', version: '疾风传·土影护卫',
    stats: { nin: 78, tai: 70, gen: 27, int: 77, str: 59, spd: 71, sta: 65, seal: 77 },
    tags: ['guard', 'ranged', 'tactics'], specialty: '土遁与熔遁配合限制行动，利用水泥状物质封住敌人，为突进创造条件。', bond: 'stoneEscort', rogue: false, glyph: '黒',
  },
  {
    id: 'akatsuchi', name: '赤土', alias: '岩之壁垒', village: 'stone', version: '疾风传·土影护卫',
    stats: { nin: 72, tai: 68, gen: 15, int: 61, str: 95, spd: 37, sta: 81, seal: 60 },
    tags: ['guard', 'assault'], specialty: '土遁制造岩石魔像与防护，厚实力量适合承受压力、守住正面阵线。', bond: 'stoneEscort', rogue: false, glyph: '赤',
  },
  {
    id: 'deidara', name: '迪达拉', alias: '爆遁艺术家', village: 'stone', version: '生前·常规',
    stats: { nin: 91, tai: 36, gen: 55, int: 83, str: 31, spd: 76, sta: 77, seal: 88 },
    tags: ['ranged', 'stealth', 'tactics'], specialty: '起爆黏土制造飞行平台、佯攻与远程爆破，通过布置控制战场；不计自爆终招。', bond: 'akatsuki', rogue: true, glyph: '爆',
  },
  // 扩充角色仍按原忍村归档；生前档案不获得秽土转生的不死与无限恢复。
  {
    id: 'hashirama', name: '千手柱间', alias: '初代火影', village: 'leaf', version: '生前·常规木遁',
    stats: { nin: 99, tai: 89, gen: 72, int: 90, str: 92, spd: 82, sta: 99, seal: 95 },
    tags: ['guard', 'seal', 'ranged'], specialty: '木遁塑造大范围战场并压制目标，查克拉储备出众；不计仙人模式与真数千手。', bond: null, rogue: false, glyph: '柱',
  },
  {
    id: 'tobirama', name: '千手扉间', alias: '二代火影', village: 'leaf', version: '生前·常规',
    stats: { nin: 95, tai: 79, gen: 58, int: 97, str: 66, spd: 96, sta: 86, seal: 98 },
    tags: ['sensor', 'tactics', 'guard'], specialty: '水遁、飞雷神与感知协同，善于迅速判断敌方机制；本局不使用秽土转生额外召人。', bond: null, rogue: false, glyph: '扉',
  },
  {
    id: 'hiruzen', name: '猿飞日斩', alias: '三代火影', village: 'leaf', version: '生前·老年',
    stats: { nin: 94, tai: 77, gen: 72, int: 96, str: 54, spd: 67, sta: 56, seal: 97 },
    tags: ['tactics', 'ranged', 'seal'], specialty: '多属性忍术与猿魔通灵应对不同战局，经验和结印突出；保留老年体力限制。', bond: null, rogue: false, glyph: '猿',
  },
  {
    id: 'minato', name: '波风水门', alias: '木叶黄色闪光', village: 'leaf', version: '生前·四代火影',
    stats: { nin: 93, tai: 81, gen: 57, int: 96, str: 65, spd: 99, sta: 82, seal: 98 },
    tags: ['tactics', 'seal', 'stealth'], specialty: '飞雷神标记提供瞬时转移与救援，螺旋丸适合快速突袭；不计九尾查克拉形态。', bond: null, rogue: false, glyph: '閃',
  },
  {
    id: 'orochimaru', name: '大蛇丸', alias: '不死的探究者', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 95, tai: 77, gen: 74, int: 97, str: 62, spd: 77, sta: 87, seal: 96 },
    tags: ['tactics', 'stealth', 'guard'], specialty: '蛇系忍术、草薙剑与身体改造覆盖多种攻防；按木叶出身归档，不额外召唤历代火影。', bond: 'sannin', rogue: true, glyph: '蛇',
  },
  {
    id: 'obito', name: '宇智波带土', alias: '面具下的神威', village: 'leaf', version: '疾风传·单万花筒',
    stats: { nin: 89, tai: 81, gen: 87, int: 88, str: 75, spd: 90, sta: 88, seal: 79 },
    tags: ['stealth', 'guard', 'tactics'], specialty: '神威的空间转移与虚化有利于渗透和避险；不计轮回眼、十尾与六道强化。', bond: null, rogue: true, glyph: '虚',
  },
  {
    id: 'shisui', name: '宇智波止水', alias: '瞬身止水', village: 'leaf', version: '生前·常规',
    stats: { nin: 85, tai: 77, gen: 97, int: 88, str: 54, spd: 97, sta: 65, seal: 85 },
    tags: ['stealth', 'tactics'], specialty: '瞬身术与写轮眼幻术擅长扰乱判断、争取先机；别天神不作为无条件任务通关效果。', bond: null, rogue: false, glyph: '瞬',
  },
  {
    id: 'guy', name: '迈特凯', alias: '木叶苍蓝猛兽', village: 'leaf', version: '疾风传·常规体术',
    stats: { nin: 28, tai: 99, gen: 22, int: 67, str: 96, spd: 97, sta: 91, seal: 23 },
    tags: ['assault', 'guard'], specialty: '扎实体术、双截棍与高强度体能训练擅长持续近战；本档案不计高阶八门爆发。', bond: 'teamGuy', rogue: false, glyph: '凱',
  },
  {
    id: 'asuma', name: '猿飞阿斯玛', alias: '飞燕之刃', village: 'leaf', version: '生前·常规',
    stats: { nin: 76, tai: 85, gen: 42, int: 82, str: 79, spd: 76, sta: 72, seal: 75 },
    tags: ['assault', 'tactics'], specialty: '查克拉刀配合风遁强化近战切割，火遁灰积烧制造范围威胁；重视小队战术配合。', bond: 'team10', rogue: false, glyph: '燕',
  },
  {
    id: 'kurenai', name: '夕日红', alias: '幻术上忍', village: 'leaf', version: '疾风传·战斗档案',
    stats: { nin: 65, tai: 56, gen: 93, int: 84, str: 37, spd: 71, sta: 55, seal: 83 },
    tags: ['stealth', 'tactics'], specialty: '幻术用于遮蔽意图、束缚和诱导目标，适合侦察掩护与战术支援。', bond: null, rogue: false, glyph: '紅',
  },
  {
    id: 'iruka', name: '海野伊鲁卡', alias: '守护学生的老师', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 53, tai: 54, gen: 43, int: 77, str: 49, spd: 53, sta: 54, seal: 62 },
    tags: ['guard', 'tactics'], specialty: '熟悉基础忍术与教学组织，具备任务判断和保护同伴的责任心，正面战力保持中忍定位。', bond: null, rogue: false, glyph: '師',
  },
  {
    id: 'sai', name: '佐井', alias: '超兽伪画', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 80, tai: 64, gen: 32, int: 83, str: 49, spd: 80, sta: 66, seal: 88 },
    tags: ['stealth', 'seal', 'ranged'], specialty: '墨绘造物可用于空中侦察、传递情报与拘束封印，暗部训练适合隐秘任务。', bond: 'team7', rogue: false, glyph: '墨',
  },
  {
    id: 'ino', name: '山中井野', alias: '心转身之花', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 70, tai: 40, gen: 48, int: 82, str: 33, spd: 61, sta: 61, seal: 82 },
    tags: ['sensor', 'medical', 'tactics'], specialty: '心转身术与感知、传讯能力支持团队协作，兼修医疗忍术，适合情报和后方保障。', bond: 'team10', rogue: false, glyph: '心',
  },
  {
    id: 'choji', name: '秋道丁次', alias: '倍化重拳', village: 'leaf', version: '疾风传·常规倍化',
    stats: { nin: 72, tai: 81, gen: 19, int: 56, str: 95, spd: 42, sta: 87, seal: 48 },
    tags: ['assault', 'guard'], specialty: '倍化术与肉弹战车提供大范围正面突破，充沛体力适合承压；不计秘药与蝶化爆发。', bond: 'team10', rogue: false, glyph: '倍',
  },
  {
    id: 'kiba', name: '犬冢牙', alias: '赤丸的搭档', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 61, tai: 78, gen: 18, int: 54, str: 69, spd: 85, sta: 73, seal: 42 },
    tags: ['sensor', 'assault'], specialty: '与忍犬赤丸配合追踪气味，牙通牙依靠高速旋转实施近战突袭。', bond: null, rogue: false, glyph: '牙',
  },
  {
    id: 'shino', name: '油女志乃', alias: '寄坏虫使', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 80, tai: 44, gen: 31, int: 86, str: 39, spd: 58, sta: 70, seal: 65 },
    tags: ['sensor', 'stealth', 'tactics'], specialty: '寄坏虫可用于追踪、分散侦察和消耗查克拉，善于隐蔽布置与分析敌人。', bond: null, rogue: false, glyph: '蟲',
  },
  {
    id: 'tenten', name: '天天', alias: '忍具百变', village: 'leaf', version: '疾风传·常规忍具',
    stats: { nin: 68, tai: 62, gen: 24, int: 68, str: 48, spd: 64, sta: 57, seal: 83 },
    tags: ['ranged', 'guard'], specialty: '卷轴收纳与投掷忍具适合远程火力和装备支援，本版本不附加六道宝具。', bond: 'teamGuy', rogue: false, glyph: '具',
  },
  {
    id: 'konohamaru', name: '猿飞木叶丸', alias: '小小螺旋丸', village: 'leaf', version: '疾风传·少年',
    stats: { nin: 57, tai: 40, gen: 21, int: 52, str: 32, spd: 49, sta: 51, seal: 43 },
    tags: ['assault', 'stealth'], specialty: '影分身佯攻配合螺旋丸制造近距离机会，按少年下忍时期收录，不采用博人传上忍能力。', bond: null, rogue: false, glyph: '丸',
  },
  {
    id: 'shizune', name: '静音', alias: '医疗班骨干', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 76, tai: 46, gen: 37, int: 88, str: 34, spd: 59, sta: 58, seal: 89 },
    tags: ['medical', 'tactics'], specialty: '医疗忍术、解毒经验与医疗班组织能力服务于持续保障，也能使用毒针进行牵制。', bond: null, rogue: false, glyph: '医',
  },
  {
    id: 'anko', name: '御手洗红豆', alias: '蛇影追踪者', village: 'leaf', version: '疾风传·常规',
    stats: { nin: 72, tai: 65, gen: 35, int: 77, str: 50, spd: 73, sta: 62, seal: 76 },
    tags: ['stealth', 'tactics'], specialty: '蛇系忍术和潜入追踪经验适合侦察与搜索，本版本不把咒印视为无限强化。', bond: null, rogue: false, glyph: '豆',
  },
  {
    id: 'sasori', name: '赤砂之蝎', alias: '百机操演', village: 'sand', version: '生前·人傀儡',
    stats: { nin: 92, tai: 46, gen: 43, int: 94, str: 40, spd: 72, sta: 79, seal: 98 },
    tags: ['ranged', 'tactics', 'guard'], specialty: '人傀儡、机关与毒形成多线攻击；以第三代风影傀儡为常用装备，不额外增加队伍人数。', bond: 'akatsuki', rogue: true, glyph: '蝎',
  },
  {
    id: 'rasa', name: '罗砂', alias: '四代风影', village: 'sand', version: '生前·常规',
    stats: { nin: 91, tai: 51, gen: 34, int: 83, str: 49, spd: 58, sta: 83, seal: 87 },
    tags: ['ranged', 'guard', 'tactics'], specialty: '磁遁操控砂金，凭借沉重介质压制砂流，适合大范围限制与阵地防御。', bond: null, rogue: false, glyph: '金',
  },
  {
    id: 'third-kazekage', name: '三代风影', alias: '砂铁磁遁', village: 'sand', version: '生前·常规',
    stats: { nin: 94, tai: 52, gen: 38, int: 85, str: 52, spd: 63, sta: 84, seal: 90 },
    tags: ['ranged', 'guard'], specialty: '磁遁操控砂铁形成远程攻击和空间封锁，按生前忍者收录，不使用被改造为傀儡后的机关。', bond: null, rogue: false, glyph: '鉄',
  },
  {
    id: 'pakura', name: '叶仓', alias: '灼遁使', village: 'sand', version: '生前·常规',
    stats: { nin: 87, tai: 60, gen: 31, int: 77, str: 45, spd: 73, sta: 69, seal: 79 },
    tags: ['ranged', 'assault'], specialty: '灼遁火球形成高温威胁，能够围绕自身控制接近路线，适合压制与突破。', bond: null, rogue: false, glyph: '灼',
  },
  {
    id: 'ebizo', name: '海老藏', alias: '砂隐长老', village: 'sand', version: '疾风传·老年',
    stats: { nin: 55, tai: 26, gen: 41, int: 92, str: 22, spd: 29, sta: 34, seal: 67 },
    tags: ['tactics'], specialty: '以长期积累的经验与情报判断协助决策；原作战斗展示有限，本游戏将其定位为智谋型长老。', bond: null, rogue: false, glyph: '老',
  },
  {
    id: 'yashamaru', name: '夜叉丸', alias: '砂隐医疗忍者', village: 'sand', version: '生前·常规',
    stats: { nin: 61, tai: 45, gen: 34, int: 75, str: 33, spd: 61, sta: 52, seal: 72 },
    tags: ['medical', 'stealth'], specialty: '医疗忍术提供照护与治疗，暗部经历适合隐蔽行动；按生前常规能力估值。', bond: null, rogue: false, glyph: '夜',
  },
  {
    id: 'matsuri', name: '祭', alias: '砂隐的新芽', village: 'sand', version: '疾风传·常规',
    stats: { nin: 42, tai: 49, gen: 23, int: 57, str: 35, spd: 52, sta: 46, seal: 43 },
    tags: ['guard'], specialty: '使用绳镖类忍具配合行动，战斗资历有限，定位为成长中的砂隐年轻忍者。', bond: null, rogue: false, glyph: '祭',
  },
  {
    id: 'gengetsu', name: '鬼灯幻月', alias: '二代水影', village: 'mist', version: '生前·常规',
    stats: { nin: 94, tai: 61, gen: 95, int: 88, str: 48, spd: 70, sta: 82, seal: 91 },
    tags: ['stealth', 'ranged', 'tactics'], specialty: '蜃的幻术隐藏本体，水铁炮与蒸危暴威制造多层威胁；不享有秽土转生的恢复能力。', bond: null, rogue: false, glyph: '蜃',
  },
  {
    id: 'yagura', name: '枸橘矢仓', alias: '四代水影', village: 'mist', version: '生前·常规人形',
    stats: { nin: 88, tai: 70, gen: 47, int: 76, str: 65, spd: 74, sta: 89, seal: 85 },
    tags: ['guard', 'tactics'], specialty: '水镜之术能够以复制攻击应对来袭目标，棍术配合水遁攻防；不计完整三尾化。', bond: null, rogue: false, glyph: '鏡',
  },
  {
    id: 'utakata', name: '羽高', alias: '泡沫之术', village: 'mist', version: '生前·常规人形',
    stats: { nin: 85, tai: 47, gen: 33, int: 73, str: 42, spd: 69, sta: 88, seal: 82 },
    tags: ['ranged', 'guard', 'stealth'], specialty: '泡沫忍术可用于移动、迷惑、包裹防护和爆破，按雾隐出身收录，不计完整六尾化。', bond: null, rogue: true, glyph: '泡',
  },
  {
    id: 'mangetsu', name: '鬼灯满月', alias: '七刀精通', village: 'mist', version: '生前·常规',
    stats: { nin: 77, tai: 89, gen: 32, int: 78, str: 81, spd: 84, sta: 78, seal: 72 },
    tags: ['assault', 'guard', 'stealth'], specialty: '精通忍刀的运用，鬼灯一族水化能力辅助攻防；作为一名忍者参与，不额外生成七名剑士。', bond: null, rogue: false, glyph: '満',
  },
  {
    id: 'fuguki', name: '西瓜山河豚鬼', alias: '大刀鲛肌', village: 'mist', version: '生前·忍刀档案',
    stats: { nin: 75, tai: 82, gen: 23, int: 67, str: 94, spd: 47, sta: 85, seal: 58 },
    tags: ['assault', 'guard'], specialty: '使用鲛肌实施近战与查克拉消耗，体格与储备见长，机动速度相对有限。', bond: null, rogue: false, glyph: '豚',
  },
  {
    id: 'jinin', name: '通草野饵人', alias: '钝刀兜割', village: 'mist', version: '生前·忍刀档案',
    stats: { nin: 53, tai: 84, gen: 19, int: 62, str: 93, spd: 58, sta: 72, seal: 43 },
    tags: ['assault'], specialty: '以兜割的斧与锤配合击破防御，擅长正面破阵；取其生前能力，不计秽土状态。', bond: null, rogue: false, glyph: '割',
  },
  {
    id: 'ameyuri', name: '林檎雨由利', alias: '雷刀牙', village: 'mist', version: '生前·忍刀档案',
    stats: { nin: 82, tai: 79, gen: 24, int: 66, str: 52, spd: 88, sta: 64, seal: 68 },
    tags: ['assault', 'ranged'], specialty: '双雷刀牙引导雷击，快速追击并压制对手，适合近中距离强攻。', bond: null, rogue: false, glyph: '牙',
  },
  {
    id: 'jinpachi', name: '无梨甚八', alias: '爆刀飞沫', village: 'mist', version: '生前·忍刀档案',
    stats: { nin: 70, tai: 80, gen: 16, int: 57, str: 85, spd: 62, sta: 72, seal: 55 },
    tags: ['assault', 'ranged'], specialty: '爆刀飞沫以起爆符配合挥砍，近战附带爆破范围威胁，擅长火力压制。', bond: null, rogue: false, glyph: '沫',
  },
  {
    id: 'kushimaru', name: '栗霰串丸', alias: '长刀缝针', village: 'mist', version: '生前·忍刀档案',
    stats: { nin: 59, tai: 83, gen: 21, int: 70, str: 58, spd: 87, sta: 65, seal: 52 },
    tags: ['stealth', 'assault'], specialty: '长刀缝针与钢丝串联目标、布置陷阱，结合无声杀人术实施隐蔽攻击。', bond: null, rogue: false, glyph: '縫',
  },
  {
    id: 'third-raikage', name: '三代雷影', alias: '最强之矛与盾', village: 'cloud', version: '生前·常规',
    stats: { nin: 82, tai: 99, gen: 19, int: 76, str: 99, spd: 92, sta: 98, seal: 46 },
    tags: ['assault', 'guard'], specialty: '雷遁查克拉模式强化防护，地狱突刺形成高贯穿攻击，耐力出众；不计秽土恢复。', bond: null, rogue: false, glyph: '雷',
  },
  {
    id: 'dodai', name: '土台', alias: '熔遁护壁', village: 'cloud', version: '疾风传·常规',
    stats: { nin: 79, tai: 47, gen: 38, int: 91, str: 42, spd: 58, sta: 64, seal: 81 },
    tags: ['guard', 'tactics'], specialty: '橡胶状熔遁可构成弹性防护和诱饵，经验有助于识别敌人弱点、组织封印配合。', bond: null, rogue: false, glyph: '護',
  },
  {
    id: 'yugito', name: '二位由木人', alias: '二尾人柱力', village: 'cloud', version: '生前·常规人形',
    stats: { nin: 83, tai: 78, gen: 27, int: 75, str: 62, spd: 87, sta: 91, seal: 71 },
    tags: ['assault', 'ranged'], specialty: '灵活身法和火焰系攻击形成追击压力，查克拉储备充裕；不计完整二尾化。', bond: null, rogue: false, glyph: '猫',
  },
  {
    id: 'omoi', name: '奥摩伊', alias: '云流剑士', village: 'cloud', version: '疾风传·常规',
    stats: { nin: 65, tai: 79, gen: 24, int: 77, str: 55, spd: 76, sta: 62, seal: 65 },
    tags: ['assault', 'tactics'], specialty: '云流剑术配合雷遁，谨慎观察后寻找反击机会，擅长保护同伴并拆解敌人攻势。', bond: 'teamSamui', rogue: false, glyph: '思',
  },
  {
    id: 'karui', name: '卡鲁伊', alias: '直率的云流剑士', village: 'cloud', version: '疾风传·常规',
    stats: { nin: 51, tai: 75, gen: 21, int: 58, str: 65, spd: 71, sta: 61, seal: 48 },
    tags: ['assault', 'guard'], specialty: '以刀术和直接果断的行动参与近战，能与奥摩伊等同伴协调执行任务。', bond: 'teamSamui', rogue: false, glyph: '刀',
  },
  {
    id: 'atsui', name: '阿茨伊', alias: '炽热的云忍', village: 'cloud', version: '疾风传·常规',
    stats: { nin: 66, tai: 66, gen: 19, int: 48, str: 62, spd: 65, sta: 63, seal: 57 },
    tags: ['assault', 'ranged'], specialty: '刀术配合火遁制造火焰攻击，行动积极，战术判断相对直率。', bond: null, rogue: false, glyph: '熱',
  },
  {
    id: 'mabui', name: '麻布依', alias: '天送之术', village: 'cloud', version: '疾风传·常规',
    stats: { nin: 72, tai: 29, gen: 35, int: 91, str: 24, spd: 43, sta: 57, seal: 94 },
    tags: ['tactics', 'guard'], specialty: '作为雷影秘书组织情报，以天送之术进行物资传送，定位为协调保障人员。', bond: null, rogue: false, glyph: '送',
  },
  {
    id: 'kinkaku', name: '金角', alias: '云隐金银兄弟', village: 'cloud', version: '生前·常规人形',
    stats: { nin: 84, tai: 86, gen: 30, int: 68, str: 87, spd: 72, sta: 94, seal: 79 },
    tags: ['assault', 'ranged', 'seal'], specialty: '强健身体与六道宝具形成近战、属性攻击及封印威胁；不计九尾查克拉暴走形态。', bond: null, rogue: true, glyph: '金',
  },
  {
    id: 'ginkaku', name: '银角', alias: '云隐金银兄弟', village: 'cloud', version: '生前·常规人形',
    stats: { nin: 80, tai: 81, gen: 31, int: 76, str: 81, spd: 73, sta: 91, seal: 87 },
    tags: ['assault', 'seal', 'tactics'], specialty: '以六道宝具配合言灵封印，善于同伴之间的连锁进攻；不计九尾查克拉外衣。', bond: null, rogue: true, glyph: '銀',
  },
  {
    id: 'mu', name: '无', alias: '二代土影', village: 'stone', version: '生前·常规',
    stats: { nin: 97, tai: 49, gen: 59, int: 93, str: 39, spd: 79, sta: 75, seal: 94 },
    tags: ['sensor', 'stealth', 'ranged'], specialty: '尘遁与隐藏身形、查克拉的能力兼顾侦察和远程打击；不享有秽土状态恢复。', bond: null, rogue: false, glyph: '無',
  },
  {
    id: 'kitsuchi', name: '黄土', alias: '岩隐大地之力', village: 'stone', version: '疾风传·常规',
    stats: { nin: 87, tai: 65, gen: 25, int: 79, str: 91, spd: 43, sta: 88, seal: 82 },
    tags: ['guard', 'assault', 'tactics'], specialty: '大规模土遁改变地形、夹击和阻挡目标，查克拉与力量适合承担正面战线。', bond: 'stoneEscort', rogue: false, glyph: '黄',
  },
  {
    id: 'roshi', name: '老紫', alias: '熔遁人柱力', village: 'stone', version: '生前·常规人形',
    stats: { nin: 86, tai: 75, gen: 24, int: 72, str: 76, spd: 63, sta: 91, seal: 70 },
    tags: ['assault', 'ranged', 'guard'], specialty: '熔遁带来高温攻防与近战压力，按岩隐出身归档；不计完整四尾化。', bond: null, rogue: true, glyph: '熔',
  },
  {
    id: 'han', name: '汉', alias: '蒸汽铠甲', village: 'stone', version: '生前·常规人形',
    stats: { nin: 79, tai: 90, gen: 19, int: 66, str: 94, spd: 81, sta: 92, seal: 57 },
    tags: ['assault', 'guard'], specialty: '蒸汽与沸遁强化近身攻击，铠甲辅助高压蒸汽作战；不计完整五尾化。', bond: null, rogue: false, glyph: '蒸',
  },
  {
    id: 'gari', name: '狩', alias: '爆遁拳锋', village: 'stone', version: '生前·常规',
    stats: { nin: 78, tai: 81, gen: 18, int: 61, str: 87, spd: 65, sta: 71, seal: 54 },
    tags: ['assault'], specialty: '爆遁在拳击接触中造成爆破伤害，适合破坏近身防线；不计秽土状态。', bond: null, rogue: false, glyph: '狩',
  },
  {
    id: 'mahiru', name: '魔蛭', alias: '岩隐前线忍者', village: 'stone', version: '生前·第三次忍界大战',
    stats: { nin: 65, tai: 58, gen: 34, int: 63, str: 49, spd: 64, sta: 57, seal: 66 },
    tags: ['stealth', 'tactics'], specialty: '以分身和前线侦察干扰敌方行动，按神无毗桥任务时期的岩隐忍者收录。', bond: null, rogue: false, glyph: '蛭',
  },
  {
    id: 'kakko', name: '火光', alias: '岩隐幻术忍者', village: 'stone', version: '生前·第三次忍界大战',
    stats: { nin: 67, tai: 62, gen: 79, int: 72, str: 56, spd: 63, sta: 59, seal: 72 },
    tags: ['tactics', 'stealth'], specialty: '利用幻术进行情报拷问，土遁控制地形，适合伏击与情报战。', bond: null, rogue: false, glyph: '光',
  },
  {
    id: 'taiseki', name: '大石', alias: '迷彩隐身', village: 'stone', version: '生前·第三次忍界大战',
    stats: { nin: 64, tai: 68, gen: 26, int: 60, str: 61, spd: 72, sta: 56, seal: 59 },
    tags: ['stealth', 'assault'], specialty: '迷彩隐身术隐藏踪迹，配合近战武器从视野盲区发动突袭。', bond: null, rogue: false, glyph: '隠',
  },
];
