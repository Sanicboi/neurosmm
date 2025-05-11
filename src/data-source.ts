import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User"
import { Video } from "./entity/Video"
import { Subtitles } from "./entity/Subtitles"
import { Avatar } from "./entity/Avatar"

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "postgres",
    port: 5432,
    username: "test",
    password: "test",
    database: "test",
    synchronize: true,
    logging: false,
    entities: [User, Video, Subtitles, Avatar],
    migrations: [],
    subscribers: [],
})
