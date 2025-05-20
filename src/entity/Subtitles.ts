import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Video } from "./Video";


@Entity()
export class Subtitles {


    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({
        default: 40
    })
    fontSize: number;

    @Column({
        default: ''
    })
    fontFamily: string;

    @Column({
        default: ''
    })
    color: string;

    @Column({
        default: 10
    })
    marginL: number;

    @Column({
        default: 10
    })
    marginR: number;

    @Column({
        default: 40
    })
    marginV: number;
    

    @ManyToOne(() => User, (user) => user.subtitles)
    user: User;
    
    @OneToMany(() => Video, (video) => video.subtitles)
    videos: Video[];
}