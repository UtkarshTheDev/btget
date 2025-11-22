export type Peer = {
  ip: string;
  port: number;
};

export type Info = {
  length: number;
  name: Buffer;
  "piece length": number;
  pieces: Buffer;
};

export type Torrent = {
  announce: string;
  info: Info;
};
