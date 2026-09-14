# 青野洞天模型

七个原创程序化 Blender 模型，由 `tools/create_realm_models.py` 制作。可编辑工程位于 `originals/models/qingye-realm.blend`，每个模型有独立集合，导出原点一致；默认展示藏经阁，可在 Outliner 中启用其他集合。

- `library.glb`：三层主阁、两座侧殿、连廊、门窗格栅、柱础、斗拱、筒瓦、屋脊和回廊栏杆。
- `pagoda.glb`：五层攒尖塔阁，各层檐口与栏杆独立建模。
- `pavilion.glb`：开放亭、茶桌和石凳。
- `ferry.glb`：渡口亭、拱形木栈道和栏杆。
- `gate.glb`：石牌坊、碑座、玉碑和屋脊。
- `crane-flight.glb`：展翼丹顶鹤，肩部与腕部为可旋转节点，羽片有双面厚度、弧度和羽轴。
- `crane-standing.glb`：收翼驻足姿态，包括颈部曲线、分层覆羽、虹膜、喙、关节和足趾。

建筑借鉴传统木构比例，服务于虚构仙境，未按某座历史建筑进行测绘复原。丹顶鹤的羽色分区参考 [International Crane Foundation](https://savingcranes.org/species/red-crowned-crane/) 与 [日本生物多样性中心](https://www.esabii.biodic.go.jp/database/migrantbirds/08.html) 的物种资料；未使用站点图片或第三方角色模型。

## 再生成

在项目根目录运行（需要 Blender 5.2；生成脚本会覆盖上述七个模型与源工程）：

```powershell
& 'D:\app\blender\blender.exe' --background --factory-startup --threads 6 --python tools\create_realm_models.py
```

如需离线检查图，将输出放在仓库外：

```powershell
& 'D:\app\blender\blender.exe' --background --factory-startup --threads 6 --python tools\create_realm_models.py -- --preview-dir "$env:TEMP\qingye-model-previews"
```

GLB 使用 Draco 压缩，原始网格数量与文件体积见 `manifest.json`。位置量化为 16 位、法线 10 位。解码器从项目已有的 Three.js r179 包复制到 `../draco/`，在本地通过 WebAssembly 解码，不依赖外部 CDN。解码器采用 Apache-2.0 许可，完整许可位于 `../draco/LICENSE`。

运行 `node tools/check_realm_models.mjs` 可验证 GLB 完整性、模型层级、解码器一致性、飞行姿态、驻足接触与静止时间行为。

浏览器端按材质合并静态建筑；仙鹤实例共享几何与材质，肩腕节点保留层级，飞行姿态由 `src/world/cranes.js` 控制。近景会收窄阴影采样区域；晨昏环境影响瓦面、木构、羽毛与窗纸亮度。石材和羽毛的细微变化由着色器补充。
