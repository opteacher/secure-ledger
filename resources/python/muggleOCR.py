"""
muggle_ocr 验证码识别桥接脚本
用法: python muggleOCR.py <image_path>
输出: <image_path> [|code|] <recognized_text>
"""
import sys

try:
    import muggle_ocr

    SDK = muggle_ocr.SDK(model_type=muggle_ocr.ModelType.Captcha)

    def predict(image_path: str) -> str:
        with open(image_path, "rb") as f:
            data = f.read()
        return SDK.predict(image_bytes=data)

except ImportError:
    # muggle_ocr 未安装时的友好报错
    print(
        "muggle_ocr not installed. Install via: pip install muggle_ocr",
        file=sys.stderr,
    )
    sys.exit(2)


def main():
    if len(sys.argv) < 2:
        print("Usage: python muggleOCR.py <image_path>", file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]
    text = predict(image_path)
    print(f"{image_path} [|code|] {text}")


if __name__ == "__main__":
    main()
