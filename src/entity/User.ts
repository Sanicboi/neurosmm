import { Entity, Column, PrimaryColumn, OneToMany } from "typeorm"
import { Video } from "./Video";

@Entity()
export class User {

    @PrimaryColumn('bigint')
    id: number;

    @Column({
        default: false
    })
    generating: boolean;

    @Column({
        default: ''
    })
    avatarId: string;

    @Column({
        default: ''
    })
    voiceId: string;

    @OneToMany(() => Video, (video) => video.user)
    videos: Video[];    

}
