"""Build the offline Worlds draft dataset from Worlds-only OE source caches.

Run worlds-fetch.py first. Scores are game-design estimates, not official ratings.
"""
import argparse
import collections
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEYS = ['mechanics', 'laning', 'teamfight', 'macro', 'vision', 'mentality']
LABELS = dict(zip(KEYS, ['操作', '对线', '团战', '运营', '视野', '稳定']))
ROLE_MAP = {'top': 'top', 'jng': 'jungle', 'mid': 'mid', 'bot': 'adc', 'sup': 'support'}
ROLE_NAMES = {'top': '上路', 'jungle': '打野', 'mid': '中路', 'adc': '下路', 'support': '辅助'}
STARTS = {2021: '2021-10-05', 2022: '2022-09-29', 2023: '2023-10-10', 2024: '2024-09-25'}
MAIN_STARTS = {2021: '2021-10-11', 2022: '2022-10-07', 2023: '2023-10-19', 2024: '2024-10-03'}
MIRRORS = {2021: 'gregvoigts/bachelor-arbeit', 2022: 'stvngo/LoL-Statistical-Analysis', 2023: 'Ashalo/LOLAnalysis', 2024: 'JianyunYe/League-of-Legends-data-analysis'}

# Team tags, region and seeding at the time of the event (not present-day names).
META = {
2021: {
'100 Thieves': ('100','LCS',1,77), 'Beyond Gaming': ('BYG','PCS',2,65),
'Cloud9': ('C9','LCS',3,79), 'DWG KIA': ('DK','LCK',1,96),
'DetonatioN FocusMe': ('DFM','LJL',1,66), 'EDward Gaming': ('EDG','LPL',1,95),
'Fnatic': ('FNC','LEC',2,72), 'FunPlus Phoenix': ('FPX','LPL',2,76),
'Galatasaray Esports': ('GS','TCL',1,63), 'Gen.G': ('GEN','LCK',2,89),
'Hanwha Life Esports': ('HLE','LCK',4,86), 'Infinity Esports': ('INF','LLA',1,52),
'LNG Esports': ('LNG','LPL',4,80), 'MAD Lions': ('MAD','LEC',1,80),
'PEACE': ('PCE','LCO',1,61), 'PSG Talon': ('PSG','PCS',1,77),
'RED Canids': ('RED','CBLOL',1,58), 'Rogue': ('RGE','LEC',3,79),
'Royal Never Give Up': ('RNG','LPL',3,90), 'T1': ('T1','LCK',3,93),
'Team Liquid': ('TL','LCS',2,79), 'Unicorns of Love.CIS': ('UOL','LCL',1,55),
},
2022: {
'100 Thieves': ('100','LCS',2,72), 'Beyond Gaming': ('BYG','PCS',2,63),
'CTBC Flying Oyster': ('CFO','PCS',1,71), 'Chiefs Esports Club': ('CHF','LCO',1,52),
'Cloud9': ('C9','LCS',1,71), 'DRX': ('DRX','LCK',4,95),
'DetonatioN FocusMe': ('DFM','LJL',1,66), 'Dplus KIA': ('DK','LCK',3,92),
'EDward Gaming': ('EDG','LPL',3,89), 'Evil Geniuses': ('EG','LCS',3,75),
'Fnatic': ('FNC','LEC',3,78), 'G2 Esports': ('G2','LEC',2,74),
'GAM Esports': ('GAM','VCS',1,70), 'Gen.G': ('GEN','LCK',1,93),
'Isurus': ('ISG','LLA',1,56), 'JD Gaming': ('JDG','LPL',1,92),
'LOUD': ('LLL','CBLOL',1,61), 'MAD Lions KOI': ('MAD','LEC',4,70),
'Rogue': ('RGE','LEC',1,81), 'Royal Never Give Up': ('RNG','LPL',4,86),
'Saigon Buffalo': ('SGB','VCS',2,66), 'T1': ('T1','LCK',2,96),
'Top Esports': ('TES','LPL',2,80), 'İstanbul Wildcats': ('IW','TCL',1,57),
},
2023: {
'Bilibili Gaming': ('BLG','LPL',2,93), 'CTBC Flying Oyster': ('CFO','PCS',2,63),
'Cloud9': ('C9','LCS',2,75), 'DetonatioN FocusMe': ('DFM','LJL',1,54),
'Dplus KIA': ('DK','LCK',4,82), 'Fnatic': ('FNC','LEC',2,78),
'G2 Esports': ('G2','LEC',1,80), 'GAM Esports': ('GAM','VCS',1,66),
'Gen.G': ('GEN','LCK',1,91), 'JD Gaming': ('JDG','LPL',1,95),
'KT Rolster': ('KT','LCK',3,88), 'LNG Esports': ('LNG','LPL',3,87),
'LOUD': ('LLL','CBLOL',1,60), 'MAD Lions': ('MAD','LEC',3,72),
'Movistar R7': ('R7','LLA',1,55), 'NRG': ('NRG','LCS',1,81),
'PSG Talon': ('PSG','PCS',1,65), 'T1': ('T1','LCK',2,98),
'Team BDS': ('BDS','LEC',4,67), 'Team Liquid': ('TL','LCS',3,71),
'Team Whales': ('TW','VCS',2,64), 'Weibo Gaming': ('WBG','LPL',4,90),
},
2024: {
'100 Thieves': ('100','LCS',3,62), 'Bilibili Gaming': ('BLG','LPL',1,96),
'Dplus KIA': ('DK','LCK',3,80), 'FlyQuest': ('FLY','LCS',1,85),
'Fnatic': ('FNC','LEC',2,75), 'Fukuoka SoftBank HAWKS gaming': ('SHG','PCS',2,56),
'G2 Esports': ('G2','LEC',1,83), 'GAM Esports': ('GAM','VCS',1,68),
'Gen.G': ('GEN','LCK',2,94), 'Hanwha Life Esports': ('HLE','LCK',1,92),
'LNG Esports': ('LNG','LPL',3,88), 'MAD Lions KOI': ('MDK','LEC',3,68),
'Movistar R7': ('R7','LLA',1,61), 'PSG Talon': ('PSG','PCS',1,72),
'T1': ('T1','LCK',4,97), 'Team Liquid': ('TL','LCS',2,79),
'Top Esports': ('TES','LPL',2,85), 'Vikings Esports': ('VKE','VCS',2,57),
'Weibo Gaming': ('WBG','LPL',4,89), 'paiN Gaming': ('PNG','CBLOL',1,59),
}}

# Event-specific identity and display corrections. OE sometimes backfills later IDs.
DISPLAY = {'1116': 'Maoan', 'MDB': 'Argonavt', 'Knight': 'knight', 'Husha': 'HuSha', 'Jojopyun': 'jojopyun', 'MISSING': 'Missing', 'CarioK': 'Cariok'}
TEAM_DISPLAY = {(2022, 'Dplus KIA'): 'DWG KIA', (2022, 'MAD Lions KOI'): 'MAD Lions', (2023, 'Movistar R7'): 'Movistar R7'}
# Small event-specific style adjustments, applied before sample shrinkage.
# These preserve a known specialty; a Finals MVP does not imply every attribute is elite.
STYLE_ADJUSTMENTS = {
(2021,'Faker'): {'macro': 4, 'teamfight': 3},
(2021,'ShowMaker'): {'mechanics': 3, 'laning': 3},
(2021,'Canyon'): {'macro': 4, 'mechanics': 3, 'teamfight': 2},
(2021,'Viper'): {'teamfight': 4, 'mechanics': 3},
(2021,'Scout'): {'teamfight': 3, 'mechanics': 2},
(2021,'Jiejie'): {'macro': 3, 'teamfight': 3},
(2021,'Chovy'): {'laning': 4},
(2021,'Keria'): {'vision': 3, 'teamfight': 2},
(2021,'Hans Sama'): {'mechanics': 2, 'teamfight': 2},
(2022,'Faker'): {'macro': 4, 'teamfight': 2},
(2022,'Zeka'): {'mechanics': 4, 'laning': 4, 'teamfight': 3},
(2022,'Kingen'): {'teamfight': 4, 'mechanics': 2},
(2022,'BeryL'): {'macro': 4, 'vision': 3},
(2022,'Deft'): {'teamfight': 2, 'macro': 2},
(2022,'Keria'): {'vision': 3, 'teamfight': 3},
(2022,'Zeus'): {'laning': 3, 'mechanics': 2},
(2022,'Ruler'): {'mechanics': 3, 'teamfight': 3},
(2022,'Canyon'): {'mechanics': 3, 'macro': 3},
(2023,'Faker'): {'macro': 5, 'teamfight': 4},
(2023,'Zeus'): {'laning': 4, 'mechanics': 3, 'teamfight': 3},
(2023,'Oner'): {'macro': 3, 'teamfight': 3},
(2023,'Gumayusi'): {'mechanics': 3, 'teamfight': 3},
(2023,'Keria'): {'vision': 4, 'macro': 3, 'teamfight': 2},
(2023,'Ruler'): {'mechanics': 3, 'teamfight': 3},
(2023,'TheShy'): {'mechanics': 2, 'laning': 2},
(2023,'Bin'): {'laning': 3, 'mechanics': 2},
(2024,'Faker'): {'macro': 4, 'teamfight': 4, 'mechanics': 2},
(2024,'Zeus'): {'laning': 2, 'teamfight': 2},
(2024,'Oner'): {'macro': 3, 'teamfight': 2},
(2024,'Gumayusi'): {'mechanics': 2, 'teamfight': 2},
(2024,'Keria'): {'vision': 4, 'macro': 3, 'teamfight': 2},
(2024,'Bin'): {'laning': 3, 'mechanics': 3},
(2024,'knight'): {'mechanics': 3, 'teamfight': 3},
(2024,'Elk'): {'mechanics': 3, 'teamfight': 3},
(2024,'Chovy'): {'laning': 3, 'mechanics': 2},
(2024,'Canyon'): {'macro': 3, 'mechanics': 2},
(2024,'Viper'): {'mechanics': 2, 'teamfight': 2},
(2024,'Massu'): {'teamfight': 3},
(2024,'Inspired'): {'macro': 2},
}
# Limited editorial targets for abilities poorly captured by DPM/wards. Each
# archive has at most two targets, and even those shrink with sample confidence.
# Targets express the named event specialty only, not a player's career peak.
SPECIALTY_TARGETS = {
(2021,'Faker'): {'macro': 94},
(2021,'Canyon'): {'macro': 97, 'mechanics': 95},
(2021,'Viper'): {'mechanics': 96},
(2021,'Keria'): {'vision': 94},
(2022,'Faker'): {'macro': 95},
(2022,'Zeka'): {'teamfight': 97, 'mechanics': 97},
(2022,'Kingen'): {'teamfight': 96},
(2022,'BeryL'): {'macro': 97},
(2022,'Canyon'): {'macro': 95},
(2023,'Faker'): {'macro': 98, 'teamfight': 95},
(2023,'Oner'): {'mechanics': 95},
(2023,'Ruler'): {'mechanics': 97, 'teamfight': 96},
(2024,'Faker'): {'macro': 97, 'teamfight': 98},
(2024,'Canyon'): {'macro': 96},
(2024,'Bin'): {'mechanics': 97, 'teamfight': 95},
}
# Position priors have similar native-role weighted totals. They describe tasks,
# not a blanket bonus for support vision or carry damage.
PRIORS = {
    'top': [82, 82, 82, 78, 70, 80],
    'jungle': [80, 76, 81, 82, 80, 80],
    'mid': [83, 83, 82, 80, 72, 80],
    'adc': [83, 82, 84, 77, 68, 80],
    'support': [78, 76, 81, 81, 83, 80],
}
# Same native-role weights as src/worlds/engine.js; display OVR rounds its
# one-decimal roleScore once more, exactly as the position-fit UI does.
ROLE_WEIGHTS = {
    'top': [.27,.27,.19,.12,.04,.11],
    'jungle': [.15,.10,.18,.28,.18,.11],
    'mid': [.25,.25,.23,.14,.03,.10],
    'adc': [.26,.22,.32,.07,.02,.11],
    'support': [.11,.05,.20,.22,.31,.11],
}
SPECIAL_NOTES = {
(2021,'Viper'): 'S11冠军下路，持续输出与团战收割突出。',
(2021,'Scout'): 'S11决赛MVP，中路对线与关键团战兼备。',
(2021,'Xiaohu'): 'S11以上路身份参赛，本档案按当年的上路表现估值。',
(2022,'Zeka'): 'S12冠军中路，淘汰赛连续打出强势对位表现。',
(2022,'Kingen'): 'S12决赛MVP，上路关键团战表现突出。',
(2022,'BeryL'): 'S12冠军辅助，游走、视野与战术协同是设计重点。',
(2023,'Zeus'): 'S13决赛MVP，边线压制和团战切入突出。',
(2023,'Faker'): 'S13冠军中路，以关键开团与团队指挥见长。',
(2024,'Faker'): 'S14决赛MVP，关键局开团与临场决策突出。',
(2024,'Massu'): 'S14八强下路，淘汰赛输出与抗压表现突出。',
}

def number(row, field):
    try: return float(row.get(field, '') or 0)
    except ValueError: return 0.0

def mean(rows, key): return sum(number(row, key) for row in rows) / len(rows)
def js_round(value):
    whole = math.floor(value)
    return whole + (value-whole >= .5)

def js_sum(values):
    # Python 3.12+ sum compensates floating point error; JS reduce does not.
    # Preserve the engine's operation order at decimal .05 rounding boundaries.
    total = 0.0
    for value in values: total += value
    return total
def clamp(value): return max(42, min(99, js_round(value)))
def percentile(value, values):
    return (sum(x < value for x in values) + sum(x == value for x in values) / 2) / len(values)

players, teams, seasons = [], [], []
coverage = []
for year in STARTS:
    all_rows = json.loads((ROOT / 'work' / f'worlds-{year}-raw.json').read_text(encoding='utf8'))
    rows = [row for row in all_rows if row['date'] >= STARTS[year]]
    names = {row['teamname'] for row in rows}
    assert names == set(META[year]), (year, names ^ set(META[year]))
    main_names = {row['teamname'] for row in rows if row['date'] >= MAIN_STARTS[year]}
    assert len(main_names) == 16, (year, main_names)
    for name in sorted(names):
        tag, region, seed, rating = META[year][name]
        teams.append(dict(id=f'{year}-{tag}', seasonId=str(year), tag=tag,
            name=TEAM_DISPLAY.get((year, name), name), region=region, seed=seed,
            rating=rating, mainEvent=name in main_names))
    game_teams = collections.defaultdict(set)
    for row in rows: game_teams[row['gameid']].add(row['teamname'])
    by_player = collections.defaultdict(list)
    for row in rows:
        if row['position'] != 'team':
            by_player[DISPLAY.get(row['playername'], row['playername'])].append(row)
    summary = {}
    for name, games in by_player.items():
        position = collections.Counter(row['position'] for row in games).most_common(1)[0][0]
        role = ROLE_MAP[position]
        kills, deaths, assists = [sum(number(row, key) for row in games) for key in ['kills','deaths','assists']]
        kp = sum(number(row,'kills') + number(row,'assists') for row in games) / max(1,sum(number(row,'teamkills') for row in games))
        summary[name] = dict(role=role, games=games, metrics={
            'kda': (kills+assists)/max(1,deaths), 'gd15':mean(games,'golddiffat15'),
            'cs15':mean(games,'csdiffat15'), 'dpm':mean(games,'dpm'),
            'vision':mean(games,'vspm') or (mean(games,'wpm')+mean(games,'wcpm')),
            'kp':kp, 'win':mean(games,'result'), 'survival':-deaths/len(games),
            'efficiency':mean(games,'damageshare')/max(.01,mean(games,'earnedgoldshare')),
            'deathRate':-deaths/max(1,sum(number(row,'gamelength')/60 for row in games)),
        })
    for name, item in summary.items():
        games, role, metrics = item['games'], item['role'], item['metrics']
        peers = [x['metrics'] for x in summary.values() if x['role'] == role]
        # Evaluate personal performances among the same Worlds role. Team results
        # are a small correction, never a six-attribute starting value.
        confidence = len(games)/(len(games)+4)
        p = {key: percentile(value,[x[key] for x in peers]) for key,value in metrics.items()}
        tag, region, seed, base = META[year][games[0]['teamname']]
        opponents = [next(t for t in game_teams[row['gameid']] if t != row['teamname']) for row in games]
        opponent_strength = sum(META[year][t][3] for t in opponents)/len(opponents)
        schedule_adjustment = max(-5, min(5, (opponent_strength-80)*.20))
        team_adjustment = (base-80)*.12
        play_in_share = sum(row['date'] < MAIN_STARTS[year] for row in games)/len(games)
        # A strong play-in line is useful evidence, but should not be equivalent
        # to posting it throughout the main event against qualified opponents.
        schedule_adjustment -= 2*play_in_share
        lane = .65*p['gd15']+.35*p['cs15']
        performance = {
            'mechanics': .45*lane+.25*p['efficiency']+.15*p['dpm']+.15*p['kda'],
            'laning': lane,
            'teamfight': .30*p['efficiency']+.25*p['dpm']+.25*p['kp']+.20*p['kda'],
            'macro': .40*p['kp']+.25*p['vision']+.20*p['win']+.15*p['efficiency'],
            'vision': p['vision'],
            # Stable play is a survival/output proxy, not a claim about psychology.
            'mentality': .60*p['deathRate']+.25*p['kda']+.15*p['kp'],
        }
        style = STYLE_ADJUSTMENTS.get((year,name),{})
        spans = dict(zip(KEYS,[38,38,38,34,34,32]))
        raw_stats = {key:prior+spans[key]*(performance[key]-.5)
                +team_adjustment+schedule_adjustment+style.get(key,0)
            for key,prior in zip(KEYS,PRIORS[role])}
        for key,target in SPECIALTY_TARGETS.get((year,name),{}).items():
            raw_stats[key] = max(raw_stats[key],target)
        stats = {key:clamp(prior+confidence*(raw_stats[key]-prior))
            for key,prior in zip(KEYS,PRIORS[role])}
        native_score = js_sum(stats[k]*w for k,w in zip(KEYS,ROLE_WEIGHTS[role]))
        rating = js_round(js_round(native_score*10)/10)
        top_keys=sorted(KEYS,key=lambda k:stats[k],reverse=True)
        tag_names={'mechanics':'操作强势','laning':'对线压制','teamfight':'团战核心','macro':'运营指挥','vision':'视野掌控','mentality':'稳定发挥'}
        identity=''.join(c.lower() for c in name if c.isalnum())
        source_stats=dict(games=len(games),winRate=round(metrics['win']*100,1),kda=round(metrics['kda'],2),
            dpm=round(metrics['dpm']),goldDiff15=round(metrics['gd15']),csDiff15=round(metrics['cs15'],1),
            killParticipation=round(metrics['kp']*100,1),visionPerMinute=round(metrics['vision'],2))
        note=SPECIAL_NOTES.get((year,name),f'S{year-2010} · {tag}{ROLE_NAMES[role]}；{tag_names[top_keys[0]]}，{tag_names[top_keys[1]]}。')
        players.append(dict(id=f'{year}-{identity}', identity=identity, name=name,
            seasonId=str(year), teamId=f'{year}-{tag}', team=tag, region=region, role=role,
            stats=stats,rating=rating,tags=[tag_names[x] for x in top_keys[:2]],note=note,
            sourceStats=source_stats))
    regions=sorted({t['region'] for t in teams if t['seasonId']==str(year)})
    source=f'https://gol.gg/tournament/tournament-stats/Worlds%20Main%20Event%20{year}/'
    seasons.append(dict(id=str(year),year=year,label=f'S{year-2010}',name=f'{year} 全球总决赛',
        champion={2021:'EDG',2022:'DRX',2023:'T1',2024:'T1'}[year],regions=regions,teamCount=len(names),
        format='groups' if year<2023 else 'swiss',source=source))
    counts=collections.Counter(p['region'] for p in players if p['seasonId']==str(year))
    coverage.append((year,len(names),len(by_player),len({row['gameid'] for row in rows}),counts))

# Derive historical opponent ratings from the same abilities and team formula
# as the user's draft. This prevents old arbitrary 95-98 opponent values from
# remaining on a different scale after recalibrating player cards.
def role_score(player, role):
    return js_round(js_sum(player['stats'][k]*w for k,w in zip(KEYS,ROLE_WEIGHTS[role]))*10)/10

for team in teams:
    roster = [player for player in players if player['teamId']==team['id']]
    starters = {role:sorted([player for player in roster if player['role']==role],
            key=lambda p:(-p['sourceStats']['games'],p['id']))[0]
        for role in ROLE_NAMES}
    selected = {player['id'] for player in starters.values()}
    substitutes = sorted([player for player in roster if player['id'] not in selected],
        key=lambda p:(-p['sourceStats']['games'],p['id']))
    scores = {role:role_score(player,role) for role,player in starters.items()}
    synergy = js_round(min(3.5,2.4+min(starters['jungle']['stats']['macro'],starters['support']['stats']['vision'])/100)*10)/10
    bonus = 0
    if substitutes:
        bench=substitutes[0]
        depth=max(0,role_score(bench,bench['role'])-scores[bench['role']])*.04
        bonus=js_round(min(2.5,role_score(bench,bench['role'])/100*1.25+bench['stats']['mentality']/100*.5+depth)*10)/10
    base=math.exp(js_sum(math.log(max(1,score)) for score in scores.values())/5)
    team['rating']=js_round(min(100,base*.94+synergy+bonus)*10)/10

roles=[dict(id=k,name=v,short={'top':'TOP','jungle':'JGL','mid':'MID','adc':'ADC','support':'SUP'}[k]) for k,v in ROLE_NAMES.items()]
regions=[dict(id=k,name=n,color=c) for k,n,c in [
('LPL','中国大陆','#ee4055'),('LCK','韩国','#a5b9ff'),('LEC','欧洲、中东与非洲','#23d5ba'),
('LCS','北美','#54aaff'),('PCS','太平洋','#ebbc61'),('VCS','越南','#f8a269'),
('CBLOL','巴西','#85d968'),('LJL','日本','#f386af'),('TCL','土耳其','#b08de8'),
('LLA','拉丁美洲','#bf94f7'),('LCO','大洋洲','#75c5d6'),('LCL','独联体','#adbacb')]]
sources=[dict(label="Oracle’s Elixir 比赛数据与字段定义",url='https://lol.timsevenhuysen.com/matchdata/'),
dict(label='Oracle’s Elixir 字段说明',url='https://lol.timsevenhuysen.com/matchdata/match-data-dictionary/')]
for y,repo in MIRRORS.items():
    sources.append(dict(label=f'{y} 逐场原始数据公开镜像',url=f'https://github.com/{repo}/blob/main/{y}_LoL_esports_match_data_from_OraclesElixir.csv'))
    sources.append(dict(label=f'{y} 世界赛统计核对',url=f'https://gol.gg/tournament/tournament-stats/Worlds%20Main%20Event%20{y}/'))

parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=ROOT/'src'/'worlds'/'data.js')
args=parser.parse_args()
args.output.parent.mkdir(parents=True,exist_ok=True)
text='// Generated with scripts/worlds-build.py. All ratings are game-design estimates.\n'
for key,value in [('STAT_KEYS',KEYS),('STAT_LABELS',LABELS),('ROLES',roles),('REGIONS',regions),('SEASONS',seasons),('TEAMS',teams),('PLAYERS',players),('SOURCES',sources)]:
    # Compact row-per-record format keeps individual players and teams easy to review.
    body='[\n'+',\n'.join('  '+json.dumps(x,ensure_ascii=False) for x in value)+'\n]' if isinstance(value,list) and value and isinstance(value[0],dict) else json.dumps(value,ensure_ascii=False)
    text+=f'export const {key} = {body};\n\n'
args.output.write_text(text,encoding='utf8')
assert len({p['id'] for p in players})==len(players)
for y,t,p,g,c in coverage:print(y,'teams',t,'players',p,'games',g,dict(c))
