import { Entity, Column, PrimaryColumn, OneToMany } from "typeorm"
import { Video } from "./Video";
import { Avatar } from "./Avatar";
import { Voice } from "./Voice";
import { Subtitles } from "./Subtitles";

@Entity()
export class User {

    @PrimaryColumn('bigint')
    id: number;

    @Column({
        default: false
    })
    generating: boolean;

    @OneToMany(() => Avatar, (avatar) => avatar.user)
    avatars: Avatar[];

    @OneToMany(() => Voice, (voice) => voice.user)
    voices: Voice[];


    @Column({
        default: 720
    })
    resWidth: number;

    @Column({
        default: 1280
    })
    resHeight: number;

    @OneToMany(() => Video, (video) => video.user)
    videos: Video[];
    
    @OneToMany(() => Subtitles, (subtitles) => subtitles.user)
    subtitles: Subtitles[];

}
