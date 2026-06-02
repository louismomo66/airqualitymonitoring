FROM golang:1.22-alpine AS builder
WORKDIR /app
# git is required by go mod download for some modules
RUN apk add --no-cache git
COPY go.mod go.sum ./
# go mod tidy regenerates go.sum inside the image so an empty local go.sum works
RUN go mod tidy
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
