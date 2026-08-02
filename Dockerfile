FROM oven/bun

WORKDIR /modparks

COPY package.json package-lock.json ./
RUN bun install

COPY . .

EXPOSE 3000 8787

CMD ["bun", "run", "dev", "--", "-H", "0.0.0.0"]
