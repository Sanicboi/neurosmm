import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Video } from "./Video";


@Entity()
export class Fragment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Video, (video) => video.fragments, {
        onDelete: 'CASCADE'
    })
    video: Video;

    @Column({
        default: 0
    })
    index: number;

    @Column({
        default: false
    })
    finished: boolean;

    @Column({
        default: 'avatar'
    })
    type: 'avatar' | 'ai';

    @Column('bytea', {
        default: Buffer.from('')
    })
    data: Buffer;

    @Column({
        nullable: true
    })
    content: string;


}