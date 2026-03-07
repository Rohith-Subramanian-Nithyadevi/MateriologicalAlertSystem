FROM haskell:9.6

WORKDIR /app

COPY backend /app

RUN cabal update && cabal build

EXPOSE 3000

CMD ["cabal", "run", "backend"]