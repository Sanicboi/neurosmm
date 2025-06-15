import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Video } from "./Video";


@Entity()
export class Image {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    basename: string;

    @Column('bytea', {
        nullable: true
    })
    data: Buffer;

    @ManyToOne(() => Video, (video) => video.images, {
        onDelete: 'CASCADE'
    })
    video: Video;
}