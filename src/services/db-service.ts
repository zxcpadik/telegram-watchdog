import { DataSource } from "typeorm"
import { User } from "../entity/user"
import { Channel } from "../entity/chanel"

if (!process.env.DB_CONNECT) {
    console.error("DB_CONNECT not specified!");
}

export const AppDataSource = new DataSource({
    type: "postgres",
    synchronize: true,
    url: process.env.DB_CONNECT,
    entities: [User, Channel],
    logging: false,
    subscribers: [],
    migrations: [],
})

AppDataSource.initialize()
  .then(() => {
    console.log("[DB] Connected!");
  })
  .catch((err) => {
    console.error("[DB] Failed!", err);
  });

export const UserRepository = AppDataSource.getRepository(User);
export const ChannelRepository = AppDataSource.getRepository(Channel);