# 青野山房 · 仙境素材

生成日期：2026-09-13。使用内置 ImageGen 工具生成，参考用户提供的仙侠登录页视觉，以及用户指定的抖音《天宫的那些日子》第 82 集（https://www.douyin.com/video/7680386091735665956）的云海与悬空建筑意境。未使用视频帧作为网站素材。

| 素材 | 尺寸 | 用途 |
| --- | --- | --- |
| realm.webp | 1672 × 941 | WebGL 初始化前或不可用时的静览背景、书卷插图 |
| realm-mobile.webp | 900 × 507 | 小屏静览背景 |
| pavilion.webp | 1672 × 941 | 内页、书阁封面、通栏场景 |
| clouds.webp | 2172 × 724，RGBA | 先前版本的透明云雾，保留存档 |

PNG 原稿保存在 originals/xianxia/。WebP 为原稿的编码优化版本，透明云层保留 alpha。界面装饰由 SVG 绘制。

当前洞天采用 Three.js 实时体积云和程序化浮岛模型。楼阁、岩层、松树、瀑布、星轨仪和仙鹤均由项目内几何与材质构成；没有使用外部游戏模型。上表记录的生成素材用于静览与书卷插图，实时云海不使用 `clouds.webp`。

## 最终生成提示词

### 青野仙境

Use case: stylized-concept. Asset type: production cinematic background art for an elegant Chinese xianxia personal blog, landscape 16:9 composition, maximum high-resolution detail. Primary request: breathtaking sophisticated photorealistic Chinese immortal realm above a vast ocean of white volumetric clouds, like the highest quality cinematic AI xianxia landscapes. Many towering slender blue-gray karst peaks and levitating mountain islands, intricate ancient Chinese celestial temples and elegant tiled pavilions, delicate waterfalls descending into dense billowing cloud banks, ancient wind-swept pine trees. A luminous enormous pale moon behind a distant central heavenly palace. A beautiful ethereal silver-white serpentine Chinese dragon with subtle champagne-gold antlers coils through the upper left clouds, gracefully integrated and not dominating. A tiny white-robed immortal seen from behind stands on a rocky pine-covered cliff in the lower left, looking across the scene. Composition: panoramic wide landscape, the dragon and nearest cliffs on left, tallest palace around 57 percent across; right third is distant quieter luminous cloud-filled mountains to accommodate an HTML glass panel. Left-center sky around 25 percent across and 40 percent down has elegant mist and enough quieter space for white text. Not a UI mockup: pure full-bleed landscape with NO text, NO letters, NO labels, NO frame, NO card, NO borders, NO logos, NO watermark. Lighting: soft heavenly daylight, cool desaturated porcelain blue, moonlit silver, ivory clouds, subtle warm champagne light, believable volumetric scattering, dramatic cloud shadows and airy depth, brilliant silver lining, tiny sunlit cranes, restrained fine gold glimmers. Materials: highly detailed craggy stone, delicate traditional architecture, authentic soft water vapor with layered fine whorls and billows. Clouds MUST look lush, deep, sculpted by light, with rich 3D volume, not flat painted fog, not simple gradients. Highest-end fantasy game environment matte painting with realistic atmospheric perspective, tasteful and peaceful, richly detailed but not overly saturated, no cartoon, no ink drawing, no purple fantasy glow.

### 透明流云

Use case: stylized-concept. Asset type: transparent PNG foreground cloud overlay for a cinematic realistic Chinese xianxia website, landscape 3:1 wide image. Generate one isolated broad cloud bank on a genuinely transparent alpha background. Beautiful softly billowing ivory and silver-blue volumetric cumulus mist, highly realistic detailed soft water vapor with intricate whorls, depth and subtle cool blue shadow in lower cloud lobes, pale warm silver sunlight on upper cloud contours. Clouds extend horizontally through the lower half, smaller disconnected wisps above, with very wispy translucent irregular edges and a transparent upper half. Taper both left and right edges to full transparency, lower edge also softly translucent. Calm elegant heavenly high-altitude sea of clouds. No mountains, no sky background, no sun, no people, no objects, no text, no solid rectangle, no border, no checkerboard. Actual alpha transparency around clouds and within feathered thin edges. This is for layering over a blue-gray immortal mountain painting: prioritize sophisticated volume and softly glowing natural vapor, not cotton balls, not vector icons, not cartoon.

### 云上书阁

Use case: stylized-concept. Asset type: wide 16:9 cinematic artwork for article and series covers in an elegant Chinese xianxia personal blog. A serene otherworldly Chinese immortal mountain study pavilion above the clouds. View from a luxurious yet restrained ancient open-air stone terrace: intricately carved pale stone balustrade in foreground, a small teal-roofed gold-trimmed pavilion and an ancient bonsai pine on the right, a jade-blue still reflecting pond with tiny white lotus blossoms, and beyond it endless monumental floating karst islands with celestial palaces and silver waterfalls flowing into breathtaking thick billowing white clouds. Cloud sea is the main subject, huge soft realistically illuminated masses with intricate vapor curls, cool blue shadows and champagne silver linings. A few graceful white cranes in the sky, mountainous horizon dissolves into soft blue mist. High-end cinematic photorealistic fantasy environment, tangible architecture and real three-dimensional atmospheric depth, dawn daylight, desaturated celestial blue, teal stone, pearl white and restrained champagne gold, peaceful mood like an immersive first-person visit to a heavenly palace. Strong wide panorama composition, no people, no writing, no UI, no text, no logos, no watermark, not cartoon, not flat watercolor.
