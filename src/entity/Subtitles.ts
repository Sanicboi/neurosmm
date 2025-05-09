import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Subtitles {


    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        default: 16
    })
    fontSize: number;

    @Column({
        default: ''
    })
    fontFamily: string;

    @Column({
        default: ''
    })
    color: string;

    @Column({
        default: 10
    })
    marginL: number;

    @Column({
        default: 10
    })
    marginR: number;

    @Column({
        default: 40
    })
    marginV: number;
}