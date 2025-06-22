import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Video } from "./Video";


@Entity()
export class Insertion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    basename: string;

    @Column('bytea', {
        nullable: true
    })
    data: Buffer;

    @ManyToOne(() => Video, (video) => video.insertions, {
        onDelete: 'CASCADE'
    })
    video: Video;

    @Column()
    index: number;
}