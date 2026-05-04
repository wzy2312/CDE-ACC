# OCR 依赖安装说明：Tesseract + pytesseract

本文用于部署「图纸 OCR 全文检索」功能中的扫描件 / 图片 PDF 识别能力。

当前系统的原生文字层 PDF 可直接通过 PyMuPDF 提取文字；只有扫描件、图片 PDF、无文字层 PDF 才需要安装 Tesseract OCR。

## 1. 空间与资源预估

| 项目 | 预计占用 |
|---|---:|
| `pytesseract` Python 包 | 小于 1 MB |
| `tesseract` 主程序 + 基础依赖 | 约 80-150 MB |
| 英文 `eng` 语言包 | 约 5-15 MB |
| 简体中文 `chi_sim` 语言包 | 约 15-30 MB |
| 中英文 OCR 最小可用安装 | 建议预留 150-300 MB |
| 全量语言包 | 不建议，可能 700 MB-1.5 GB |

生产环境建议额外预留：

| 资源 | 建议 |
|---|---:|
| 临时磁盘空间 | 至少 2-5 GB |
| 内存 | 4 GB 起，批量 OCR 建议 8 GB+ |
| CPU | OCR 为 CPU 密集型，建议后台队列限并发 |

## 2. 当前系统使用方式

OCR 提取脚本：

```text
extract_drawing_ocr.py
```

脚本中默认语言：

```python
lang = "chi_sim+eng"
```

因此只需要安装：

```text
tesseract
eng
chi_sim
pytesseract
```

不建议安装全量语言包。

## 3. macOS 安装

适用于本机 demo 或 macOS 部署环境。

```bash
brew install tesseract
brew install tesseract-lang
```

安装 Python 包：

```bash
/Users/zhiyuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m pip install pytesseract
```

如果是项目自己的 Python 环境，请改用对应环境的 `python -m pip install pytesseract`。

验证：

```bash
tesseract --version
tesseract --list-langs
```

确认输出中包含：

```text
eng
chi_sim
```

## 4. Ubuntu / Debian 安装

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-sim
```

安装 Python 包：

```bash
python3 -m pip install pytesseract
```

验证：

```bash
tesseract --version
tesseract --list-langs
python3 -c "import pytesseract; print(pytesseract.get_tesseract_version())"
```

## 5. Dockerfile 示例

如果后端以 Docker 部署，可在镜像中加入：

```dockerfile
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-chi-sim \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --no-cache-dir pytesseract
```

如果镜像使用虚拟环境，请将 `python3 -m pip` 改为对应虚拟环境路径。

## 6. 系统验证

安装后重启 CDE 后端服务。

```bash
npm run dev
```

检查健康接口：

```bash
curl -s http://127.0.0.1:8080/healthz
```

确认包含：

```json
"drawingOcrExtractScript": {
  "configured": true,
  "exists": true
}
```

注意：健康接口只能确认 OCR 脚本存在，不能完全证明 Tesseract 语言包可用。需要上传扫描件 PDF 后观察 OCR 任务是否完成。

## 7. 功能验证步骤

1. 登录系统。
2. 上传一份扫描件 PDF。
3. 上传时勾选「标记为图纸」。
4. 填写完整图纸属性：图纸编号、图纸名称、专业、版本号。
5. 进入「图纸应用 / 图纸 OCR 全文检索」。
6. 查看该图纸 OCR 任务是否从「排队中」进入「已完成」或「质量警告」。
7. 搜索图纸中的关键词，确认可定位到页码和区域。

## 8. 常见问题

### 8.1 OCR 页面显示「可检索图纸 0」

通常不是 OCR 安装问题，而是文件没有声明为图纸。

当前 OCR 只索引满足以下条件的文件：

```text
PDF 文件
上传时 markedAsDrawing = true
图纸编号、图纸名称、专业、版本号填写完整
```

普通 PDF 不会自动进入图纸 OCR 索引。

### 8.2 OCR 任务质量警告

常见原因：

```text
扫描分辨率低
图纸倾斜
文字过小
中英文混排识别不稳定
Tesseract 未安装 chi_sim 语言包
```

建议重新上传 300 DPI 以上扫描件，或改用带原生文字层的 PDF。

### 8.3 提示 OCR 引擎不可用

检查：

```bash
tesseract --version
tesseract --list-langs
python3 -c "import pytesseract"
```

如果 `python3 -c "import pytesseract"` 失败，说明 Python 包未安装到后端实际使用的 Python 环境中。

## 9. 生产建议

建议将 OCR 任务放入后台队列并限制并发，避免大批量图纸同时 OCR 造成 CPU 和临时磁盘压力。

建议保留以下监控指标：

```text
OCR 任务耗时
OCR 失败率
质量警告页数
低置信度文字块数量
临时目录磁盘使用率
OCR 队列积压数量
```

如需更高识别准确率，可后续替换为商业 OCR API，但仍保留当前索引结构：文件级、页面级、文字块级。
