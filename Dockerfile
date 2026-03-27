FROM debian:10

# 设置工作目录
WORKDIR /build

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    python3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 设置环境变量
ENV PATH=/usr/local/node/bin:$PATH

# 复制项目文件
COPY . /build/

# 安装依赖并构建
RUN npm install
RUN npm run build:linux

# 输出构建结果
CMD ["cp", "-r", "/build/release/.", "/output/"]