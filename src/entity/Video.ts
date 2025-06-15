import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Subtitles } from "./Subtitles";
import { Avatar } from "./Avatar";
import { Voice } from "./Voice";
import { Image } from "./Image";



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

    @OneToMany(() => Image, (image) => image.video)
    images: Image[];

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
        nullable: true
    })
    basename: string;
}