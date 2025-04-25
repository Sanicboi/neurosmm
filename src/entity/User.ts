import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class User {

    @PrimaryColumn('bigint')
    id: number;

    @Column({
        default: false
    })
    generating: boolean;

    @Column({
        default: ''
    })
    avatarId: string;

    @Column({
        default: ''
    })
    voiceId: string;

    

}
