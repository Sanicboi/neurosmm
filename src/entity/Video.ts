import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "./User";
import { Subtitles } from "./Subtitles";



@Entity() 
export class Video {


    @PrimaryColumn()
    id: string;

    @Column()
    url: string;

    @ManyToOne(() => User, (user) => user.videos)
    user: User;

    @ManyToOne(() => Subtitles, (subtitles) => subtitles.videos)
    subtitles: Subtitles;

    @Column({
        default: false
    })
    active: boolean;

    @Column('bytea', {
        nullable: true
    })
    file: Buffer;
}