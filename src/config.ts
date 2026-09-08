// 站点级配置：公告、giscus 留言、友链，一处修改全站生效
export const siteConfig = {
  name: '青野山房',
  subtitle: '云深不知处，码上见真章',
  author: '青野散人',
  // 公告条：text 为 null 时全站不显示；id 变更后已关闭的用户会重新看到
  announcement: {
    id: '2026-light-theme',
    text: '山房新葺：全站已换成云海白昼景，新增连载系列、友邻仙山与留言板，欢迎道友重游。',
  } as { id: string; text: string } | null,
  // giscus 配置：默认 null 表示留言功能待接入；填入后即可在 /guestbook 启用
  // 参考 https://giscus.app/zh-CN 生成以下字段
  giscus: null as null | {
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
    mapping?: string;
  },
  icp: '蜀ICP备00000000号-0', // 备案号占位
};

export const friendLinks = [
  { name: '蓬莱码字阁', url: 'https://penglai.example.com', desc: '东海仙岛上的写作道场，日更千字，雷打不动。' },
  { name: '昆仑镜像站', url: 'https://kunlun.example.com', desc: '西王母的技术镜像，功法秘籍一应俱全。' },
  { name: '崂山丹房', url: 'https://laoshan.example.com', desc: '外丹黄白之术与现代前端炼丹炉的跨界实验。' },
  { name: '峨眉剑修笔记', url: 'https://emei.example.com', desc: '以剑入道，以编辑器为剑匣的修行日志。' },
  { name: '终南隐士录', url: 'https://zhongnan.example.com', desc: '隐居深山的全栈散人，种菜与写库并行。' },
  { name: '天师府符箓局', url: 'https://tianshi.example.com', desc: '符箓即代码，朱砂即注释的正一法脉。' },
  { name: '沧海遗珠集', url: 'https://canghai.example.com', desc: '打捞互联网旧时代的沧海遗珠， weekly 更新。' },
];
