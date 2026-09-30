---
title: 用 Rust 写了两个自己每天都会用的小工具
description: 一个是把剪贴板里的时间戳转成人类可读的时间，一个是批量重命名照片。都是几十行的小东西，但用起来很顺手。
pubDate: 2026-09-20
category: 折腾
tags: ['Rust', 'CLI']
---

一直以来都有个习惯：能自己写的小工具就自己写，哪怕只有几十行。原因很简单，用别人的工具要迁就别人的想法，自己写的话，改一行就好。

## 时间戳

从日志里复制出来一坨 `1758971234`，每次都要开浏览器去查，太蠢了。所以写了个命令行的小东西：

```rust
fn main() -> Result<()> {
    let arg = std::env::args().nth(1).context("用法：ts <时间戳>")?;
    let secs: i64 = arg.parse()?;
    let t = OffsetDateTime::from_unix_timestamp(secs)?
        .to_offset(UtcOffset::from_hms(8, 0, 0)?);
    println!("{}", t.format(&format_description::well_known::Rfc3339)?);
    Ok(())
}
```

错误处理用 `anyhow`，参数解析干脆手写 —— 只有一个参数，引一个 clap 进来会显得很滑稽。

## 照片重命名

相机导出来的文件名叫 `IMG_4821.JPG`，堆在一起完全看不出是什么时候拍的。现在按 `2026-09-20-001.jpg` 的格式批量改，顺序就是拍摄时间。

> 写小工具的标准只有一个：它要真的被用起来。写完第一次就再没用过的东西，不如不写。

写完这两个之后，命令行里少了两条需要翻文档的操作，这就够了。