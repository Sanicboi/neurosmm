import "reflect-metadata"
import { DataSource } from "typeorm"
import { Insertion } from "./entity/Insertion"
import { Video } from "./entity/Video"


export const AppDataSource = new DataSource({
    type: "postgres",
    host: "postgres",
    port: 5432,
    username: "test",
    password: "test",
    database: "test",
    synchronize: true,
    logging: false,
    entities: [Video, Insertion],
    migrations: [],
    subscribers: [],
})
