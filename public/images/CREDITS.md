# 图片素材版权记录（CREDITS）

本站 `public/images/` 下的装饰图片均取材于 Wikimedia Commons 上的**公有领域（Public Domain）**中国古画高清扫描件，或由程序生成。所有画作作者均已逝世超过 700 年，依据各国著作权法（包括中国《著作权法》与美国版权法）早已进入公有领域；Wikimedia Commons 对这些二维公有领域作品的忠实数字化扫描件同样标记为公有领域（PD-art / PD-old）。

---

## 1. `pano-mountains.jpg`（首页中段装饰横幅）

- **来源画作**：《千里江山图》卷（局部裁切：主峰群青绿山水段）
- **作者**：王希孟（北宋，1096–约1119），1113 年作
- **现藏**：北京故宫博物院
- **Wikimedia 文件页**：https://commons.wikimedia.org/wiki/File:Wang_Ximeng._A_Thousand_Li_of_Rivers_and_Mountains._(Complete,_51,3x1191,5_cm)._1113._Palace_museum,_Beijing.jpg
- **公有领域理由**：北宋画作，作者逝世逾 900 年，著作权保护期早已届满；扫描件为公有领域二维作品的忠实复制（PD-art）。

## 2. `cranes.jpg`（关于页 / 页脚上方装饰）

- **来源画作**：《瑞鹤图》卷（亮版，白鹤、祥云与宣德门屋脊段）
- **作者**：赵佶（宋徽宗，北宋，1082–1135），1112 年作
- **现藏**：辽宁省博物馆
- **Wikimedia 文件页**：https://commons.wikimedia.org/wiki/File:%E7%91%9E%E9%B9%A4%E5%9B%BE%EF%BC%88%E4%BA%AE%E7%89%88%EF%BC%89.jpg
- **公有领域理由**：北宋画作，作者逝世逾 880 年，著作权保护期早已届满；扫描件为公有领域二维作品的忠实复制（PD-art）。

## 3. `ink-mountains.jpg`（归档 / 文章页眉装饰）

- **来源画作**：《富春山居图·无用师卷》（局部裁切：水墨层叠远山段）
- **作者**：黄公望（元，1269–1354），1350 年前后作
- **现藏**：台北故宫博物院
- **Wikimedia 文件页**：https://commons.wikimedia.org/wiki/File:%E5%AF%8C%E6%98%A5%E5%B1%B1%E5%B1%85%E5%9C%96(%E7%84%A1%E7%94%A8%E5%B8%AB%E5%8D%B7).jpg
- **公有领域理由**：元代画作，作者逝世逾 660 年，著作权保护期早已届满；扫描件为公有领域二维作品的忠实复制（PD-art）。

## 4. `paper-texture.jpg`（卷轴文章页纸面）

- **来源**：程序生成（Python PIL / numpy），非取材于任何外部作品
- **说明**：米白宣纸纹理，底色 #faf8f3，叠加细腻纤维噪声与帘纹
- **版权**：由本站构建脚本生成，可自由使用

## 5. `cloud-sea-hero.jpg`（Hero 背景 / 默认 OG 图）

- **来源画作**：《黄山图册》第 1 册第 6 开（百步云梯·云海，青绿远峰浮出云海）
- **作者**：梅清（清，1623–1697）
- **现藏**：故宫博物院（北京）
- **Wikimedia 文件页**：https://commons.wikimedia.org/wiki/File:%E6%A2%85%E6%B8%85%E9%BB%84%E5%B1%B1%E5%9B%BE%E5%86%8C1-6.png
- **公有领域理由**：清代画作，作者逝世逾 320 年，著作权保护期早已届满；扫描件为公有领域二维作品的忠实复制（PD-art）。

---

*以上素材均于下载后经裁切、缩放与 JPEG 压缩处理（quality 80–85，progressive），处理过程未改变原作的公有领域属性。*

---

## 追加处理记录（白色仙雾版）

- `pano-ink.jpg`：由 `pano-mountains.jpg`（《千里江山图》局部）经 `tools/process_pano.py` 处理生成：灰度化、自动对比、gamma 0.72 提亮，再做暖墨灰（#3a3630）到宣纸白（#f4f0e5）的 duotone 映射，用作首页通栏以匹配全站白玉金配色。原画的公有领域属性不因处理而改变。
- `cranes.jpg`：未改文件本体，页面中以 CSS `filter: saturate(0.55) brightness(1.06)` 轻度降饱和呈现。
