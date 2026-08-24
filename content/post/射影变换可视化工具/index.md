---
title: "射影变换可视化工具"
date: 2026-08-25T00:30:00+08:00
slug: "projective-viz"
image: "cover.png"
categories: ["数学"]
tags: ["射影几何", "可视化", "Canvas"]
draft: false
---

<!-- 这是可选的博文模板。正文随意改写；定稿发布前记得删除上面的 draft: true 行。 -->
<!-- 工具本体已放在仓库 static/projective-viz/，发布后地址固定为 /projective-viz/ -->

做解析几何时想要一个能直观看到"曲线被射影矩阵变换后变成什么"的工具，于是自己写了一个：

**[打开射影变换可视化工具 →](/projective-viz/)**

<!-- 如果哪天想把工具直接嵌进博文（而不是跳转），取消下面这行注释即可（主题已开 unsafe，无需改配置）：
<iframe src="/projective-viz/" style="width:100%;height:900px;border:1px solid #ddd;border-radius:8px" title="射影变换可视化工具"></iframe>
-->

## 能做什么

- 输入显式函数、圆锥曲线或隐式方程，左右双画布对照变换前后的图像
- 3×3 矩阵可手动调，也内置单灭点/双灭点/强透视等预设
- 自动判别曲线类型（圆/椭圆/抛物线/双曲线），变换后的像同样判别
- 3D 相机视角：拖拽相机直接得到对应的透视矩阵

## 输入示例

```
sin(x)*x            显式函数
x^2+y^2=1           单位圆
x^2/4-y^2/9=1       双曲线
x^2+2*x*y+y^2=1     含 xy 项
x^3-3*x*y^2=0       高次代数曲线
sin(x^2+y^2)=cos(x*y)   隐式曲线
```

<!-- 在这里继续写正文 -->
