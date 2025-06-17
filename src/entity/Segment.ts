import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Video } from "./Video";



@Entity() 
export class Segment {


    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Video, (video) => video.segments)
    video: Video;

    @Column({
        default: 0
    })
    index: number;

    @Column('bytea', {
        nullable: true
    })
    data: Buffer;
}