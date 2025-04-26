import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "./User";



@Entity() 
export class Video {


    @PrimaryColumn()
    id: string;

    @Column()
    url: string;

    @ManyToOne(() => User, (user) => user.videos)
    user: User;
}