import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Insertion } from "./Insertion";



@Entity() 
export class Video {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable: true
    })
    chatId: string;

    @Column('bytea', {
        nullable: true
    })
    buffer: Buffer;

    @Column({
        nullable: true
    })
    avatarId: string;

    @Column({
        nullable: true
    })
    voiceId: string;

    @Column({
        nullable: true
    })
    avatarType: 'avatar' | 'talking_photo';

    @OneToMany(() => Insertion, (insertion) => insertion.video)
    insertions: Insertion[];

    @Column({
        default: false
    })
    finished: boolean;
}