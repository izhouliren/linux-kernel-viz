// 中国企业名单 — 模糊匹配企业名
// 来源: 公开渠道整理, 涵盖主要贡献 Linux 内核的中国/华人企业
// 注意: Lenovo、OnePlus、Samsung(中国分部) 等可能不完全是中国企业,
// 这里按"主要贡献者华人"或"总部在中国"列入
// 用法: 大小写不敏感, 子串匹配
// 重要: 不要放入过短或过通用的词 (如 "ICT", "Tech", "CS"), 会误中

export const CHINESE_COMPANIES = [
  // 大厂 (互联网/手机/家电)
  'Huawei',
  'Alibaba',
  'Tencent',
  'Baidu',
  'Bytedance',
  'ByteDance',
  'JD.com',
  'Xiaomi',
  'OPPO',
  'Vivo',
  'OnePlus',
  'ZTE',
  'Lenovo',
  'Inspur',
  'Sugon',
  'Dawning',
  'Greatwall',
  'Founder',
  'Tongfang',
  'Hisense',
  'Haier',
  'Midea',
  'Gree',

  // 芯片 / 处理器
  'Hygon',
  'Loongson',
  'Phytium',
  'Montage',
  'Ingenic',
  'Allwinner',
  'Rockchip',
  'Amlogic',
  'Cambricon',
  'Horizon',
  'Black Sesame',
  'Moore Threads',
  'Iluvatar',
  'Biren',
  'Unisoc',
  'UNISOC',
  'Spreadtrum',
  'Leadcore',
  'RDA',
  'Espressif',
  'Bouffalo',
  'MXCHIP',
  'Sipeed',
  'Beken',

  // 台湾 IC 设计/制造 (列入, 同属中华区)
  'MediaTek',
  'Realtek',
  'Novatek',
  'MStar',
  'Foxconn',
  'ASUS',
  'Wistron',
  'Quanta',
  'Compal',
  'Pegatron',
  'HTC',
  'Acer',

  // 操作系统 / 国产化
  'OpenEuler',
  'openEuler',
  'UnionTech',
  'Uniontech',
  'Kylin',
  'Loongnix',
  'Deepin',
  'Tongxin',
  'iSoft',
  'CS2C',
  'StartOS',
  'NeoKylin',
  'Huayi',

  // 通信
  'China Telecom',
  'China Mobile',
  'China Unicom',
  'TP-Link',
  'TP-LINK',
  'FiberHome',
  'Datang',
  'Potevio',
  'Comba Telecom',
  'New H3C',
  'H3C',
  'Ruijie',
  'Maipu',
  'ZTEsoft',
  'Huawei Tech',  // 避免命中 "Science Fiction Technologies"

  // 嵌入式 / IoT
  'FriendlyARM',
  'FriendlyElec',
  'Banana Pi',
  'Orange Pi',
  'MangoPi',
  'CubieTech',
  'Widora',
  'Lichee',
  'W600',

  // 监控 / 安防
  'Hikvision',
  'Dahua',
  'Uniview',
  'TVT',

  // AI / 互联网
  'Megvii',
  'SenseTime',
  'iQIYI',
  'Qihoo 360',
  'Meitu',

  // 网络安全
  'NSFOCUS',
  'Venustech',
  'Topsec',
  'DBAPP Security',
  'Sangfor',

  // 邮件域名暗示 (兜底)
  'cnlinux',
  'kernel-labor',
  'kernel-developer',
]
