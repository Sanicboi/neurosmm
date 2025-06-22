import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Subtitles } from "./Subtitles";
import { Avatar } from "./Avatar";
import { Voice } from "./Voice";
import { Insertion } from "./Insertion";



@Entity() 
export class Video {


    @PrimaryGeneratedColumn()
    id: number;



    @ManyToOne(() => User, (user) => user.videos)
    user: User;

    @ManyToOne(() => Subtitles, (subtitles) => subtitles.videos, {
        nullable: true
    })
    subtitles: Subtitles;

    @ManyToOne(() => Avatar, (avatar) => avatar.videos, {
        nullable: true
    })
    avatar: Avatar;

    @ManyToOne(() => Voice, (voice) => voice.videos, {
        nullable: true
    })
    voice: Voice;

    @OneToMany(() => Insertion, (insertion) => insertion.video)
    insertions: Insertion[];

    @Column({
        default: 1080
    })
    width: number;

    @Column({
        default: 1920
    })
    height: number;

    @Column({
        default: false
    })
    active: boolean;

    @Column('bytea', {
        nullable: true
    })
    file: Buffer | null;

    @Column({
        nullable: true
    })
    transcribed: string;

    @Column({
        default: 'result.mp4'
    })
    basename: string;

    @Column({
        default: ''
    })
    prompt: string;
}