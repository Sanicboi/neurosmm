import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Video } from "./Video";


@Entity()
export class Insertion {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Video, (video) => video.insertions, {
        onDelete: 'CASCADE'
    })
    video: Video;

    @Column('bytea', {
        nullable: true
    })
    buffer: Buffer;

    @Column('real', {
        nullable: true
    })
    duration: number;

    @Column({
        nullable: true
    })
    prompt: string;

    @Column('real', {
        nullable: true
    })
    start: number;
}